import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from lobby_qa_scope import ROOM_BROWSER_CSS, classify, select


class ScopeTests(unittest.TestCase):
    def test_css_only(self):
        self.assertEqual(classify([("M", ROOM_BROWSER_CSS)]), "visual")
        self.assertEqual(classify([("M", ROOM_BROWSER_CSS), ("A", "docs/notes.md")]), "visual")

    def test_conservative(self):
        for changes in ([], [("A", "docs/notes.md")], [("D", ROOM_BROWSER_CSS)],
                        [("A", ROOM_BROWSER_CSS)], [("M", "components/entry/AccountAuthScreen.module.css")],
                        [("M", ROOM_BROWSER_CSS), ("M", "components/entry/RoomBrowser.tsx")],
                        [("M", ROOM_BROWSER_CSS), ("M", "game/clock.ts")],
                        [("M", ROOM_BROWSER_CSS), ("M", ".github/workflows/lobby-qa.yml")]):
            self.assertEqual(classify(changes), "full", changes)

    def test_non_work_and_missing_base(self):
        sha = "a" * 40
        for event, ref, before in (("pull_request", "refs/heads/work/test", sha),
                                   ("push", "refs/heads/development", sha),
                                   ("push", "refs/heads/work/test", "0" * 40)):
            self.assertEqual(select(event, ref, before, sha), "full")
        with patch("lobby_qa_scope.git", side_effect=subprocess.CalledProcessError(1, "git")):
            self.assertEqual(select("push", "refs/heads/work/test", sha, sha), "full")

    def test_real_git_diff(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(["git", "-C", directory, *args],
                                               stderr=subprocess.DEVNULL)
            git("init")
            git("config", "user.email", "qa@example.invalid")
            git("config", "user.name", "QA")
            css = Path(directory, ROOM_BROWSER_CSS)
            css.parent.mkdir(parents=True)
            css.write_text(".a { color: red; }\n")
            git("add", ".")
            git("commit", "-m", "base")
            before = git("rev-parse", "HEAD").decode().strip()
            css.write_text(".a { color: blue; }\n")
            git("commit", "-am", "css")
            after = git("rev-parse", "HEAD").decode().strip()
            with patch("lobby_qa_scope.git", side_effect=git):
                self.assertEqual(select("push", "refs/heads/work/test", before, after), "visual")
                self.assertEqual(select("pull_request", "refs/heads/work/test", before, after), "full")


if __name__ == "__main__":
    unittest.main()
