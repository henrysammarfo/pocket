/**
 * ElevenLabs speak-back for plan + block lines.
 * Requires ELEVENLABS_API_KEY. No fake audio when unset — returns 503.
 */

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const key = process.env["ELEVENLABS_API_KEY"];
  const voice = process.env["ELEVENLABS_VOICE_ID"] || "21m00Tcm4TlvDq8ikWAM";
  if (!key) throw new Error("ELEVENLABS_API_KEY required for speak-back");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.4, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
