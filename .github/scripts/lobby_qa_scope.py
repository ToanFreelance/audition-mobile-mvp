"""Conservative work-push QA routing. PR and integration checks stay full."""
import os
import re
import subprocess
import sys

ROOM_BROWSER_CSS = "components/entry/RoomBrowser.module.css"


def classify(changes):
    """Only modified Room Browser CSS, optionally with Markdown docs, is light."""
    has_css = False
    for status, path in changes:
        if path == ROOM_BROWSER_CSS and status == "M":
            has_css = True
        elif status in ("A", "M", "D") and path.startswith("docs/") and path.endswith(".md"):
            continue
        else:
            return "full"
    return "visual" if has_css else "full"


def git(*args):
    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL)


def select(event, ref, before, after):
    if event != "push" or not ref.startswith("refs/heads/work/"):
        return "full"
    if not all(re.fullmatch(r"[0-9a-f]{40}", sha or "") and sha != "0" * 40
               for sha in (before, after)):
        return "full"
    try:
        if git("rev-parse", "HEAD").decode().strip() != after:
            return "full"
        # Shallow checkout may not have the old tip for a multi-commit push.
        # Do not guess from HEAD^ or fetch an unbounded repository history.
        git("merge-base", "--is-ancestor", before, after)
        raw = git("diff", "--no-renames", "--name-status", "-z", before, after)
        fields = raw.decode("utf-8").split("\0")
        if fields[-1] != "" or (len(fields) - 1) % 2:
            return "full"
        return classify(zip(fields[0:-1:2], fields[1:-1:2]))
    except (OSError, subprocess.CalledProcessError, UnicodeError):
        return "full"


def main():
    scope = select(os.getenv("GITHUB_EVENT_NAME", ""), os.getenv("GITHUB_REF", ""),
                   os.getenv("PUSH_BEFORE", ""), os.getenv("PUSH_AFTER", ""))
    print("Lobby QA scope:", scope)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("scope=" + scope + "\n")
    if scope == "visual":
        # A malformed patch fails rather than silently becoming an accepted change.
        subprocess.run(["git", "diff", "--check", os.environ["PUSH_BEFORE"],
                        os.environ["PUSH_AFTER"]], check=True)


if __name__ == "__main__":
    main()
