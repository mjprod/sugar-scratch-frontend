import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  prefix,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const floating = focused || value.length > 0;

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.fontSize = "";
    const max = 22;
    const min = 14;
    let size = max;
    input.style.fontSize = `${size}px`;
    while (size > min && input.scrollWidth > input.clientWidth + 1) {
      size -= 0.5;
      input.style.fontSize = `${size}px`;
    }
  }, [value]);

  return (
    <div
      className={[
        "lp-build-page4-field",
        floating ? "is-floating" : "",
        prefix ? "has-prefix" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <label htmlFor={id}>{label}</label>
      {prefix ? <span className="lp-build-page5-prefix">{prefix}</span> : null}
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value.replace(/^@+/, ""))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function ThankYou({ onReset }: { onReset: () => void }) {
  return (
    <div className="lp-build-page6-message">
      <div className="lp-build-page3-headline">Submitted!</div>
      <div className="lp-build-copy-wrap lp-build-page6-copy">
        <img
          src="/svg/scratchHeartBg.svg"
          alt=""
          className="lp-build-copy-heart"
          aria-hidden="true"
          draggable={false}
        />
        <p className="lp-build-copy">
          Your account manger{" "}
          <span className="lp-build-username">Jorlyn</span> will contact you
          in the next 24 hours.
        </p>
      </div>
      <p className="lp-build-page6-contact">
        Any questions? <a href="mailto:hello@sugarscratch.com">Email Us</a>
      </p>
      <p className="lp-build-page6-contact">
        <button type="button" className="lp-build-page6-reset" onClick={onReset}>
          Reset submission
        </button>
      </p>
    </div>
  );
}

export function LpBuildJoin({
  submitted,
  onSubmitted,
  onReset,
  progress = 1,
}: {
  submitted: boolean;
  onSubmitted: () => void;
  onReset: () => void;
  progress?: number;
}) {
  const handleId = useId();
  const firstId = useId();
  const lastId = useId();
  const emailId = useId();
  const [handle, setHandle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tossed, setTossed] = useState(false);
  const ready = handle && firstName && lastName && email;
  const enter = Math.min(1, Math.max(0, progress));
  const titleShift = (1 - enter) * 28;
  const fieldsShift = (1 - enter) * 64;
  const handOpacity = enter >= 0.92 ? Math.min(1, (enter - 0.92) / 0.08) : 0;

  useEffect(() => {
    if (!submitted) setTossed(false);
  }, [submitted]);

  useEffect(() => {
    if (!tossed || submitted) return;
    const id = window.setTimeout(() => onSubmitted(), 1550);
    return () => window.clearTimeout(id);
  }, [onSubmitted, submitted, tossed]);

  return (
    <div className="lp-build-join">
      {submitted ? (
        <div className="lp-build-page5-thanks is-in">
          <ThankYou onReset={onReset} />
        </div>
      ) : (
        <form
          className={
            tossed ? "lp-build-page5-form is-exiting" : "lp-build-page5-form"
          }
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready || tossed) return;
            setTossed(true);
          }}
        >
          <div
            className="lp-build-page3-headline"
            style={{ transform: `translate3d(0, ${titleShift}px, 0)` }}
          >
            Join Sugar Scratch
          </div>
          <div
            className="lp-build-page5-fields"
            style={{ transform: `translate3d(0, ${fieldsShift}px, 0)` }}
          >
          <Field
            id={handleId}
            label="Social Handle"
            prefix="@"
            value={handle}
            onChange={setHandle}
            autoComplete="username"
          />
          <div className="lp-build-page5-name-row">
            <Field
              id={firstId}
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              autoComplete="given-name"
            />
            <Field
              id={lastId}
              label="Last Name"
              value={lastName}
              onChange={setLastName}
              autoComplete="family-name"
            />
          </div>
          <Field
            id={emailId}
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <div className="lp-build-page5-cta">
            <CtaButton
              {...ctaButtonPropsFromTemplate("squircleCTA")}
              fillParent
              label="Submit"
              costAmount={null}
              type="submit"
              fontSize={14}
              disabled={!ready || tossed}
            />
          </div>
          </div>
        </form>
      )}
      {!submitted ? (
        <div
          className="lp-build-page5-hand-stage"
          style={{ opacity: tossed ? 1 : handOpacity }}
        >
          <img
            src="/images/hand.webp"
            alt=""
            className={
              tossed ? "lp-build-page5-hand is-tossed" : "lp-build-page5-hand"
            }
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  );
}
