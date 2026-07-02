import type { ChatBroadcastPayload, ChatChannel } from "@mmo/shared";

export interface ChatBoxOptions {
  /** Send a message on a channel. */
  onSend: (channel: ChatChannel, text: string) => void;
  /** Send a private message: "/w <name> <text>". */
  onWhisper: (to: string, text: string) => void;
  /** Fired when the chat input gains/loses focus (so the game can pause
   *  keyboard movement while the player is typing). */
  onFocusChange: (focused: boolean) => void;
}

/** Matches "/w name rest" or "/whisper name rest" (name is one token). */
const WHISPER_RE = /^\/w(?:hisper)?\s+(\S+)\s+([\s\S]+)$/i;

const MAX_LINES = 60;

/**
 * The DOM chat overlay + a small zone HUD. Owns the existing #chat / #hud
 * elements (created hidden in index.html), shows them, and wires keyboard
 * focus so typing doesn't drive the character. Text is inserted as a text node
 * (never innerHTML) so chat can't inject markup.
 */
export class ChatBox {
  private readonly root = document.getElementById("chat") as HTMLDivElement;
  private readonly log = document.getElementById("chat-log") as HTMLDivElement;
  private readonly input = document.getElementById("chat-input") as HTMLInputElement;
  private readonly channelBtn = document.getElementById("chat-channel") as HTMLButtonElement;
  private readonly hud = document.getElementById("hud") as HTMLDivElement;
  private channel: ChatChannel = "zone";

  private readonly onWindowKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && document.activeElement !== this.input) {
      e.preventDefault();
      this.input.focus();
    }
  };
  private readonly onInputKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = this.input.value.trim();
      this.input.value = "";
      if (text) {
        const w = WHISPER_RE.exec(text);
        if (w) this.opts.onWhisper(w[1]!, w[2]!.trim());
        else this.opts.onSend(this.channel, text);
      }
      this.input.blur();
    } else if (e.key === "Escape") {
      this.input.value = "";
      this.input.blur();
    }
  };
  private readonly onFocus = (): void => this.opts.onFocusChange(true);
  private readonly onBlur = (): void => this.opts.onFocusChange(false);
  private readonly onChannelClick = (): void => this.toggleChannel();

  constructor(private readonly opts: ChatBoxOptions) {
    window.addEventListener("keydown", this.onWindowKey);
    this.input.addEventListener("keydown", this.onInputKey);
    this.input.addEventListener("focus", this.onFocus);
    this.input.addEventListener("blur", this.onBlur);
    this.channelBtn.addEventListener("click", this.onChannelClick);
    this.root.style.display = "flex";
    this.hud.style.display = "block";
  }

  private toggleChannel(): void {
    this.channel = this.channel === "zone" ? "global" : "zone";
    this.channelBtn.textContent = this.channel === "zone" ? "Zone" : "Global";
    this.channelBtn.classList.toggle("global", this.channel === "global");
    this.input.focus();
  }

  addMessage(p: ChatBroadcastPayload): void {
    const line = document.createElement("div");
    line.className = `line ${p.channel}`;
    const from = document.createElement("span");
    from.className = "from";
    if (p.channel === "whisper") from.textContent = `[w] ${p.from} » ${p.to}: `;
    else from.textContent = `${p.channel === "global" ? "[G] " : ""}${p.from}: `;
    line.appendChild(from);
    line.appendChild(document.createTextNode(p.text));
    this.log.appendChild(line);
    while (this.log.childElementCount > MAX_LINES && this.log.firstChild) {
      this.log.removeChild(this.log.firstChild);
    }
    this.log.scrollTop = this.log.scrollHeight;
  }

  setHud(text: string): void {
    this.hud.textContent = text;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onWindowKey);
    this.input.removeEventListener("keydown", this.onInputKey);
    this.input.removeEventListener("focus", this.onFocus);
    this.input.removeEventListener("blur", this.onBlur);
    this.channelBtn.removeEventListener("click", this.onChannelClick);
    this.root.style.display = "none";
    this.hud.style.display = "none";
  }
}
