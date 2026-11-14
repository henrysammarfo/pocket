#!/usr/bin/env python3
"""Builds the Pocket demo video from the recording (record.mjs), the cards (cards.mjs) and script.json.
Voiceover: edge-tts. Output: 1920x1080 H.264 MP4 plus a 1280x720 poster.
Usage: python3 scripts/video/build.py RAW_DIR CARDS_DIR OUT_DIR"""
import json, os, subprocess, sys, shutil
RAW, CARDS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
S = json.load(open(os.path.join(HERE, 'script.json'))); EV = json.load(open(os.path.join(RAW, 'events.json')))
VOICE_NOTE = os.path.join(ROOT, 'tests/e2e/fixtures/messy-voice.mp3')
TMP = os.path.join(OUT, 'work'); os.makedirs(TMP, exist_ok=True)
# Play the real voice note, with long pauses trimmed so the demo stays tight.
_vn = os.path.join(TMP, 'voice-note.m4a')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VOICE_NOTE, '-af', 'silenceremove=stop_periods=-1:stop_duration=0.25:stop_threshold=-38dB,atempo=1.08', _vn], check=True)
VOICE_NOTE = _vn
FPS, XF = 30, 0.4
TTS = shutil.which('edge-tts') or os.path.expanduser('~/.local/bin/edge-tts')
def run(cmd): subprocess.run(cmd, check=True)
def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
def tts(text, name):
    f = os.path.join(TMP, name + '.mp3')
    if not os.path.exists(f): run([TTS, '--voice', S['voice'], '--rate', S['rate'], '--text', text, '--write-media', f])
    return f
def smooth(a, w=0.6): return f"(clip((it-({a:.3f}))/{w},0,1)*clip((it-({a:.3f}))/{w},0,1)*(3-2*clip((it-({a:.3f}))/{w},0,1)))"
scenes = []
for i, s in enumerate(S['scenes']):
    vo = tts(s['vo'], s['id']); vd = dur(vo); audio = [(vo, 0.35)]; t_end = 0.35 + vd
    if s.get('audio') == 'voice':
        audio.append((VOICE_NOTE, t_end + 0.25)); t_end += 0.25 + dur(VOICE_NOTE)
    pre = 0.0
    if s.get('vo2'):
        v2 = tts(s['vo2'], s['id'] + '_2'); pre = t_end + 0.1; audio.append((v2, t_end + 0.3)); t_end += 0.3 + dur(v2)
    out = os.path.join(TMP, f"s{i:02d}.mp4"); bg = os.path.join(CARDS, s['id'] + '.png')
    if s['kind'] == 'card':
        D = max(t_end + 0.7, 2.5)
        z = f"1+0.035*it/{D:.2f}"
        run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', f"{D:.3f}", '-i', bg, '-vf',
             f"scale=3840:2160,zoompan=z='{z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps={FPS},format=yuv420p", '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-r', str(FPS), out])
    else:
        ev = EV['phone' if s['kind'] == 'phone' else 'desktop']; src = os.path.join(RAW, ('phone' if s['kind'] == 'phone' else 'desktop') + '.mp4')
        a = ev[s['from']] - (0.15 if s['kind'] == 'phone' else 0.3); b = (ev[s['to']] if 'to' in s else ev[s['from']] + s.get('len', 2)) + s.get('tail', 0)
        if s.get('src'): a, b = s['src']
        segs = [(a, b)]
        if s.get('cut'):
            c1, c2, keep = ev[s['cut'][0]] + s['cut'][2], ev[s['cut'][1]] - 0.3, 0
            if c2 > c1: segs = [(a, c1), (c2, b)]
        V = sum(y - x for x, y in segs)
        need = max(t_end + 0.6 - pre, 1.5)
        speed = 1.0
        if s.get('speed', True) and V > need + 1.2: speed = min(2.2, V / need)
        D = max(pre + V / speed, t_end + 0.6)
        def map_t(t):  # source time to scene time
            acc = 0.0
            for x, y in segs:
                if t <= y: return pre + (acc + max(0, t - x)) / speed
                acc += y - x
            return pre + acc / speed
        parts = ''.join(f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS[p{k}];" for k, (x, y) in enumerate(segs))
        chain = parts + (''.join(f"[p{k}]" for k in range(len(segs))) + f"concat=n={len(segs)}:v=1:a=0[c];" if len(segs) > 1 else "[p0]copy[c];")
        chain += f"[c]setpts=PTS/{speed:.4f},fps={FPS},tpad=start_duration={pre:.3f}:start_mode=clone:stop_duration={D:.3f}:stop_mode=clone,trim=0:{D:.3f},setpts=PTS-STARTPTS"
        if s['kind'] == 'phone':
            # Zoom by growing the whole phone toward the viewer and panning to the focus point, so nothing inside the screen is cropped sideways.
            zm = s.get('zoom'); Z, fy, sm = 1.0, 0.5, '0'
            if zm:
                za = map_t(ev[zm['at']]) + 0.1; zb = D - 0.8; Z, fy = zm['z'], zm['y']
                sm = f"{smooth(za).replace('it', 't')}*(1-{smooth(zb).replace('it', 't')})"
            zt = f"(1+({Z}-1)*{sm})"
            ypos = f"(46*(1-{sm})+min(0,max(1080-overlay_h,540-{fy}*overlay_h))*{sm})"
            chain += f",scale=444:960,format=rgba[scr];[2:v]format=gray,scale=444:960[mk];[scr][mk]alphamerge[scrA];[3:v]format=rgba[bz];[bz][scrA]overlay=14:14:shortest=1,format=rgba,scale=w='trunc(472*{zt}/2)*2':h='trunc(988*{zt}/2)*2':eval=frame[pz];[1:v][pz]overlay=x='1462-overlay_w/2':y='{ypos}':eval=frame,format=yuv420p"
            mask = os.path.join(CARDS, 'mask-phone.png')
        else:
            chain += f",scale=1480:824[ph];[2:v]format=gray[mk];[ph][mk]alphamerge[pm];[1:v][pm]overlay=220:50,format=yuv420p"
            mask = os.path.join(CARDS, 'mask-desktop.png')
        run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-loop', '1', '-i', bg, '-loop', '1', '-i', mask, '-loop', '1', '-i', os.path.join(CARDS, 'bezel.png'), '-filter_complex', chain, '-t', f"{D:.3f}", '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-r', str(FPS), out])
    scenes.append({'id': s['id'], 'file': out, 'D': D, 'audio': audio, 'vo': s['vo'] + (' ' + s['vo2'] if s.get('vo2') else '')})
    print(f"{s['id']:9s} {D:5.2f}s", flush=True)
# Join with short cross fades, then lay the voice and the voice note on the same timeline.
starts, t = [], 0.0
for k, sc in enumerate(scenes): starts.append(t); t += sc['D'] - XF
total = t + XF
inputs, fc, last = [], '', '[0:v]'
for sc in scenes: inputs += ['-i', sc['file']]
off = scenes[0]['D'] - XF
for k in range(1, len(scenes)):
    fc += f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[x{k}];"; last = f"[x{k}]"; off += scenes[k]['D'] - XF
na = len(scenes); amix = []
for k, sc in enumerate(scenes):
    for f, o in sc['audio']:
        inputs += ['-i', f]; ms = int((starts[k] + o) * 1000)
        vol = '1.0' if f != VOICE_NOTE else '1.15'
        fc += f"[{na}:a]aresample=48000,volume={vol},adelay={ms}|{ms}[a{na}];"; amix.append(f"[a{na}]"); na += 1
fc += ''.join(amix) + f"amix=inputs={len(amix)}:normalize=0,apad,atrim=0:{total:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[aout]"
final = os.path.join(OUT, 'pocket-demo.mp4')
run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', fc, '-map', last, '-map', '[aout]', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', final])
# Captions file (SRT) for platforms that accept one, timed to each scene's voice.
def ts(x): h, m = int(x // 3600), int(x % 3600 // 60); return f"{h:02d}:{m:02d}:{x % 60:06.3f}".replace('.', ',')
with open(os.path.join(OUT, 'pocket-demo.srt'), 'w') as f:
    for k, sc in enumerate(scenes): f.write(f"{k + 1}\n{ts(starts[k] + 0.3)} --> {ts(starts[k] + sc['D'] - 0.2)}\n{sc['vo']}\n\n")
json.dump({'total': total, 'scenes': [{'id': s['id'], 'start': round(st, 2), 'D': round(s['D'], 2)} for s, st in zip(scenes, starts)]}, open(os.path.join(OUT, 'timeline.json'), 'w'), indent=1)
print('total', round(total, 2), final)
