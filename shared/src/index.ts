/**
 * Public barrel for the pure, engine-agnostic parts of the game.
 *
 * NOTE: Colyseus schema classes are intentionally NOT re-exported here. They
 * use decorators and pull in `@colyseus/schema` at runtime; keeping them out of
 * this barrel means the Phaser client can freely `import { ... } from
 * "@mmo/shared"` for utilities without dragging schema/decorators into the
 * browser bundle. Import schema explicitly from "@mmo/shared/schema/state"
 * (the server imports the values; the client imports types only).
 */
export * from "./types";
export * from "./data/abilities";
export * from "./systems/combat";
export * from "./systems/movement";
export * from "./protocol/messages";
