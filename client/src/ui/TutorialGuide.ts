/**
 * First-launch tutorial: a short sequence of dismissible cards that teach the
 * controls and core loops (play-test ask). Pure DOM, no game state — shown
 * once per browser (localStorage flag), always skippable, and re-teachable
 * later from Settings.
 */
const DONE_KEY = "mmo:tutorial-done";

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Emberfall",
    body:
      "A world lit by dying embers. Move with <b>WASD</b> or the <b>arrow keys</b> " +
      "(on touch: drag the left half of the screen). Walk onto glowing road " +
      "gates to travel between zones.",
  },
  {
    title: "Combat",
    body:
      "<b>Click an enemy</b> to target it (Esc clears). <b>Hold Space</b> to attack " +
      "on the global cooldown, and use <b>1 / 2 / 3</b> for Strike, Power Strike and " +
      "Mend. Gray <i>Miss</i> means the swing didn't land — better gear and levels " +
      "mean fewer misses.",
  },
  {
    title: "Gather & craft",
    body:
      "Click glowing <b>rocks</b> and <b>fishing spots</b> to gather — you'll see " +
      "<b>+1</b> float up when it lands in your bag. Press <b>C</b> (or click the " +
      "⚒ <b>Forge</b> beside Dorin the Smith) to smelt ore into bars and forge gear.",
  },
  {
    title: "Your panels",
    body:
      "<b>I</b> bag & equipment · <b>J</b> quest log · <b>C</b> crafting · <b>B</b> bank " +
      "(stand at the bank) · <b>T</b> trade · <b>X</b> the Exchange (at a vendor) · " +
      "<b>F</b> friends · <b>P</b> party · <b>G</b> guild · <b>M</b> ride your mount.",
  },
  {
    title: "Quests & people",
    body:
      "Glowing figures in town are <b>NPCs</b> — click them to talk, take quests and " +
      "buy from vendors. Quest turn-ins count <b>equipped</b> items too. The blue " +
      "<b>Waystone</b> fast-travels between towns for a few coins.",
  },
  {
    title: "Danger & death",
    body:
      "Dying wears your gear — <b>repair at a vendor</b>. Falling in a dungeon drags " +
      "you back outside. The <b>Ashreach</b> (north of the forest) has the best " +
      "resources but open PvP: die there and you drop your best items. Good luck!",
  },
];

export class TutorialGuide {
  private readonly root = document.getElementById("tutorial") as HTMLDivElement;
  private readonly titleEl = document.getElementById("tutorial-title") as HTMLDivElement;
  private readonly bodyEl = document.getElementById("tutorial-body") as HTMLDivElement;
  private readonly nextBtn = document.getElementById("tutorial-next") as HTMLButtonElement;
  private readonly skipBtn = document.getElementById("tutorial-skip") as HTMLButtonElement;
  private readonly stepEl = document.getElementById("tutorial-step") as HTMLDivElement;
  private step = 0;

  constructor() {
    this.nextBtn.addEventListener("click", () => this.advance());
    this.skipBtn.addEventListener("click", () => this.finish());
  }

  /** Show on first launch only (or when forced from Settings). */
  maybeShow(force = false): void {
    if (!force && localStorage.getItem(DONE_KEY)) return;
    this.step = 0;
    this.render();
    this.root.style.display = "flex";
  }

  private advance(): void {
    this.step += 1;
    if (this.step >= STEPS.length) this.finish();
    else this.render();
  }

  private render(): void {
    const s = STEPS[this.step]!;
    this.titleEl.textContent = s.title;
    this.bodyEl.innerHTML = s.body; // authored copy above — no user input
    this.stepEl.textContent = `${this.step + 1} / ${STEPS.length}`;
    this.nextBtn.textContent = this.step === STEPS.length - 1 ? "Play!" : "Next";
  }

  private finish(): void {
    localStorage.setItem(DONE_KEY, "1");
    this.root.style.display = "none";
  }

  destroy(): void {
    this.root.style.display = "none";
  }
}
