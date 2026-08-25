import { fsrs, generatorParameters, Rating, type Card as FsrsCard, type State } from "ts-fsrs";
import type { Card } from "@prisma/client";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export { Rating };

function toFsrsCard(card: Card): FsrsCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learningSteps,
    state: card.state as State,
    last_review: card.lastReview ?? undefined,
  };
}

/** Returns the DB fields to persist after reviewing a card with the given rating. */
export function review(card: Card, rating: Rating.Again | Rating.Hard | Rating.Good | Rating.Easy, now = new Date()) {
  const next = scheduler.next(toFsrsCard(card), now, rating).card;
  return {
    due: next.due,
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    learningSteps: next.learning_steps,
    state: next.state as number,
    lastReview: now,
  };
}
