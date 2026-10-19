import { useId, useLayoutEffect, useRef, useState } from "react";
import { CtaButton, ctaButtonPropsFromTemplate } from "@/components/cta";
import { LpBuildShell } from "@/pages/lp-build/LpBuildShell";

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
    const max = 18;
    const min = 11;
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

export function LpBuildPage5() {
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

  return (
    <LpBuildShell>
      <form
        className="lp-build-page5-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          setTossed(true);
        }}
      >
        <div className="lp-build-page3-headline">Join Sugar Scratch</div>
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
            disabled={!ready}
          />
        </div>
      </form>
      <div className="lp-build-page5-hand-stage">
        <img
          src="/images/hand.webp"
          alt=""
          className={
            tossed ? "lp-build-page5-hand is-tossed" : "lp-build-page5-hand"
          }
          draggable={false}
        />
      </div>
    </LpBuildShell>
  );
}
