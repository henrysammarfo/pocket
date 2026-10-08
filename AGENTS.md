<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The signed-in product is a threaded chat assistant at /app/$threadId; /dashboard redirects there. Why: POCKET is a conversational consumer app.
- AI streaming and voice transcription live in server routes (src/routes/api/chat.ts, api/transcribe.ts) that verify the member's bearer token. Why: keeps the AI key server-side and data per-member.
- Chat history is stored per member in threads/thread_messages with RLS. Why: conversations sync across devices.
