import { FormEvent, useState } from "react";
import { enquirySessionTypes } from "../../data/packages";
import { submitEnquiry } from "../../lib/publicApi";
import { Button } from "../ui/Button";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const accessKey = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? "") || undefined,
      sessionType: String(formData.get("sessionType") ?? "") || undefined,
      message: String(formData.get("message") ?? ""),
      botcheck: String(formData.get("botcheck") ?? ""),
    };

    setStatus("sending");
    let apiOk = false;
    let web3Ok = false;

    try {
      await submitEnquiry(payload);
      apiOk = true;
    } catch {
      /* fall through — try Web3Forms if configured */
    }

    if (accessKey) {
      try {
        const data = new FormData();
        data.append("access_key", accessKey);
        data.append("subject", "Photo Arena website enquiry");
        data.append("name", payload.name);
        data.append("email", payload.email);
        if (payload.phone) data.append("phone", payload.phone);
        if (payload.sessionType) data.append("sessionType", payload.sessionType);
        data.append("message", payload.message);
        data.append("botcheck", payload.botcheck ?? "");
        const response = await fetch("https://api.web3forms.com/submit", { method: "POST", body: data });
        web3Ok = response.ok;
      } catch {
        web3Ok = false;
      }
    }

    if (apiOk || web3Ok) {
      setStatus("sent");
      form.reset();
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-form">
      <input type="text" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
      <div className="space-y-1.5">
        <label htmlFor="name" className="pa-label !mb-0">
          Name
        </label>
        <input id="name" name="name" required autoComplete="name" className="pa-input" />
      </div>
      <div className="grid gap-form sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="email" className="pa-label !mb-0">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="pa-input"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="pa-label !mb-0">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="pa-input" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="sessionType" className="pa-label !mb-0">
          What would you like to book?
        </label>
        <select id="sessionType" name="sessionType" className="pa-input">
          <option value="">Select a session type</option>
          {enquirySessionTypes.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="General Enquiry">General Enquiry</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="message" className="pa-label !mb-0">
          Message
        </label>
        <textarea id="message" name="message" required rows={5} className="pa-input" />
      </div>
      <div className="pt-1">
        <Button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
        </Button>
      </div>
      {status === "sent" ? (
        <p className="text-sm text-success">Message sent. We will reply shortly.</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-error">
          The message could not be sent. Please call or email the studio.
        </p>
      ) : null}
    </form>
  );
}
