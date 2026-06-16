import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

/**
 * Profanity censoring for chat. Uses the obscenity English dataset (handles
 * common obfuscations like l33t-speak and spacing). Pure: text in, censored
 * text out — so chat moderation is independent of the network layer.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
const censor = new TextCensor();

export function censorText(text: string): string {
  const matches = matcher.getAllMatches(text);
  return censor.applyTo(text, matches);
}
