"""Probe and fully decode delivered videos; synchronize against source frame counts."""
import argparse
import json
import subprocess
from pathlib import Path


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--male-render',required=True)
    ap.add_argument('--female-render',required=True);args=ap.parse_args();out=Path(args.out)
    manifest=json.loads((out/'motion-source/source-manifest.json').read_text());expected={}
    for m in manifest['motions']:
        a,b=m['source_frame_range'];lo,hi=m['working_frame_range'];name=m['id']
        expected[f'motion-source/{name}.mp4']=b-a
        expected[f'motion-source/{name}-solver-padding.mp4']=hi-lo
        expected[f'qa/{name}-qa.mp4']=b-a
    expected['qa/source-male-female.mp4']=277
    expected['qa/pose-2d-overlay.mp4']=281
    expected['qa/pose-3d-projections.mp4']=281
    result=[]
    for relative,count in expected.items():
        path=out/relative
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames',
            '-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_read_frames,duration','-of','json',str(path)]))['streams'][0]
        decode=subprocess.run(['ffmpeg','-hide_banner','-v','error','-xerror','-i',str(path),'-f','null','-'],capture_output=True,text=True)
        valid=int(probe['nb_read_frames'])==count and probe['avg_frame_rate']=='30/1' and decode.returncode==0
        result.append(dict(path=relative,expected_frames=count,probe=probe,full_decode_pass=decode.returncode==0,pass_all=valid,
                           error=decode.stderr or None))
    renders=[]
    for p in [args.male_render,args.female_render]:
        d=json.loads((Path(p)/'render.json').read_text());renders.append(d)
        assert d['frames']==list(range(4,281)) and d['source_fps']==30
        assert len(list(Path(p).glob('*.png')))==277
        assert all(abs(d['actions'][m['id']][1]-(m['source_frame_range'][1]-m['source_frame_range'][0]))<1e-4 for m in manifest['motions'])
    report=dict(all_pass=all(r['pass_all'] for r in result),videos=result,renders=renders,
                visual_scope='Actual GLB render, source-synchronized. Human inspection is sampled contact sheets; owner acceptance pending.')
    (out/'qa/video-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    assert report['all_pass'],report
    print(json.dumps(dict(all_pass=report['all_pass'],video_files=len(result),rendered_frames_per_character=277)))


if __name__=='__main__':main()
