import type { ReactNode } from "react";

type PlayStep = {
  title: string;
  sentence: string;
  icon: ReactNode;
};

function CollectIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.19 2.25c.78.01 1.52.48 1.81 1.25l5 11.95c.09.26.14.55.13.8a2.02 2.02 0 0 1-1.23 1.8L9.53 21.1c-.26.12-.53.15-.79.15A2 2 0 0 1 6.93 20L1.97 8.05c-.42-1.01.07-2.18 1.09-2.6l7.36-3.05c.25-.09.51-.15.77-.15m3.48 0h1.45a2 2 0 0 1 2 2v6.35zm5.46 1.54l1.34.57a1.99 1.99 0 0 1 1.09 2.6l-2.43 5.86zm-8.94.43L3.8 7.29L8.77 19.3l7.4-3.06zM8.65 8.54l3.23 2.41l-.44 4.01l-3.23-2.42z"
      />
    </svg>
  );
}

function ScratchMatchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 512 512" aria-hidden="true">
      <path
        fill="currentColor"
        d="M190.03 21.97c-.71-.003-1.422.01-2.124.03c38.633 74.657 186.967 157.52 307.906 333.03c-38.488-159.928-215.34-332.78-305.78-333.06zM83.53 65.374c61.253 98.216 249.157 212.75 375.75 378.844C420.49 283.03 173.3 62.907 83.53 65.374m-67.31 81.313c59.365 87.324 194.506 155.172 355.03 345.125c-38.792-161.19-265.263-347.592-355.03-345.125"
      />
    </svg>
  );
}

function WinDiamondsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.027 8.558h5.946L12.439 3.5h-.877zm2.53 11.119V9.442H3.03zm.885 0l8.53-10.235h-8.53zm3.508-11.12h5.271l-2.075-4.169q-.224-.404-.601-.646t-.847-.242h-4.271zm-13.171 0H8.05L10.573 3.5H6.302q-.47 0-.846.242t-.602.647z"
      />
    </svg>
  );
}

const STEPS: PlayStep[] = [
  {
    title: "Collect",
    sentence:
      "Grab every influencer to build a legendary full set!",
    icon: <CollectIcon />,
  },
  {
    title: "Scratch & Match",
    sentence: "Match symbols to unlock secret photo cards.",
    icon: <ScratchMatchIcon />,
  },
  {
    title: "Win Diamonds",
    sentence: "Scratch your cards and rake in the diamonds!",
    icon: <WinDiamondsIcon />,
  },
];

function PlayStepCard({
  step,
  featured = false,
}: {
  step: PlayStep;
  featured?: boolean;
}) {
  return (
    <article
      className={[
        "home-play-steps-card",
        featured ? "home-play-steps-card--featured" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="home-play-steps-icon">{step.icon}</span>
      <h3 className="home-play-steps-title">{step.title}</h3>
      <p className="home-play-steps-copy">{step.sentence}</p>
    </article>
  );
}

export function PlaySteps() {
  return (
    <section className="home-play-steps" aria-label="How to play">
      <div className="home-play-steps-grid">
        {STEPS.map((step, index) => (
          <PlayStepCard
            key={step.title}
            step={step}
            featured={index === 1}
          />
        ))}
      </div>
    </section>
  );
}
