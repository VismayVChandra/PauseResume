"use client";

import { useCallback, useState } from "react";
import { PauseResumeWordmark } from "@/components/genforge/logo";
import { ProgressStepper } from "@/components/genforge/progress-stepper";
import { Landing } from "@/components/genforge/landing";
import { TemplateStep } from "@/components/TemplateStep";
import { TargetRoleStep } from "@/components/TargetRoleStep";
import { UploadStep } from "@/components/UploadStep";
import { ExtractionLoading } from "@/components/genforge/extraction-loading";
import { ReviewForm } from "@/components/ReviewForm";
import { ScoreStep } from "@/components/ScoreStep";
import { InterviewStep } from "@/components/InterviewStep";
import { ExportStep } from "@/components/ExportStep";
import { RawProfile, TailoredResume, TemplateId } from "@/types/resume";
import { getOrCreateSessionId } from "@/lib/supabase";

type Stage = "landing" | "flow";
type Step =
  | "template"
  | "target-role"
  | "upload"
  | "extracting"
  | "review"
  | "score"
  | "interview"
  | "export";

const STEP_NUMBER: Record<Step, number> = {
  template: 1,
  "target-role": 2,
  upload: 3,
  extracting: 3,
  review: 4,
  score: 5,
  interview: 6,
  export: 7,
};

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [step, setStep] = useState<Step>("template");
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [targetRole, setTargetRole] = useState("");
  const [careerProfileId, setCareerProfileId] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resume, setResume] = useState<TailoredResume | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const sessionId = typeof window !== "undefined" ? getOrCreateSessionId() : "server";

  const runExtractionAndTailoring = useCallback(
    async (opts: { formData?: FormData; text?: string; manualProfile?: RawProfile; demo?: boolean }) => {
      setStep("extracting");
      setReady(false);
      setError(null);
      try {
        let careerProfileIdLocal: string;
        let profile: RawProfile;

        if (opts.manualProfile) {
          const direct = await fetch("/api/manual-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-session-id": sessionId },
            body: JSON.stringify({ profile: opts.manualProfile }),
          });
          const directJson = await direct.json();
          if (!direct.ok) throw new Error(directJson.error || "Failed to save manual profile.");
          careerProfileIdLocal = directJson.careerProfileId;
          profile = directJson.profile;
        } else {
          const form = opts.formData || new FormData();
          if (opts.demo) form.set("mode", "demo");

          const isJsonText = Boolean(opts.text) && !opts.formData;
          const res = await fetch("/api/extract-profile", {
            method: "POST",
            headers: isJsonText
              ? { "Content-Type": "application/json", "x-session-id": sessionId }
              : { "x-session-id": sessionId },
            body: isJsonText ? JSON.stringify({ text: opts.text }) : form,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Extraction failed.");
          careerProfileIdLocal = json.careerProfileId;
          profile = json.profile;
        }

        setCareerProfileId(careerProfileIdLocal);

        const tailorRes = await fetch("/api/tailor-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ careerProfileId: careerProfileIdLocal, targetRole, templateId }),
        });
        const tailorJson = await tailorRes.json();
        if (!tailorRes.ok) throw new Error(tailorJson.error || "Tailoring failed.");

        setResumeId(tailorJson.resumeId);
        setResume(tailorJson.resume);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStep("upload");
      }
    },
    [targetRole, templateId, sessionId]
  );

  async function handleSubmitFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    await runExtractionAndTailoring({ formData: form });
  }

  async function saveEdits(next: TailoredResume) {
    setResume(next);
    if (!resumeId) return;
    setSaveStatus("saving");
    try {
      await fetch(`/api/resumes/${resumeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: next }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <button
            onClick={() => {
              setStage("landing");
              setStep("template");
            }}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="PauseResume home"
          >
            <PauseResumeWordmark />
          </button>

          {stage === "flow" && step !== "extracting" && (
            <div className="hidden max-w-2xl flex-1 sm:block">
              <ProgressStepper current={STEP_NUMBER[step]} />
            </div>
          )}

          <div className="w-[104px] shrink-0 text-right">
            {stage === "flow" && step !== "extracting" && (
              <span className="font-mono text-xs text-muted-foreground">
                {String(STEP_NUMBER[step]).padStart(2, "0")} / 07
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {stage === "landing" && (
          <Landing
            onStart={() => {
              setStage("flow");
              setStep("template");
            }}
          />
        )}

        {stage === "flow" && (
          <div className="mx-auto max-w-6xl px-6">
            {error && (
              <div className="mx-auto mt-6 max-w-2xl rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === "template" && (
              <TemplateStep
                onNext={(id) => {
                  setTemplateId(id);
                  setStep("target-role");
                }}
              />
            )}

            {step === "target-role" && (
              <TargetRoleStep
                onNext={(role) => {
                  setTargetRole(role);
                  setStep("upload");
                }}
              />
            )}

            {step === "upload" && (
              <UploadStep
                loading={false}
                onError={setError}
                onSubmitFile={handleSubmitFile}
                onDemo={() => runExtractionAndTailoring({ demo: true })}
                onExtracted={(payload) => {
                  if (payload.manualProfile) {
                    runExtractionAndTailoring({ manualProfile: payload.manualProfile });
                  } else if (payload.text) {
                    runExtractionAndTailoring({ text: payload.text });
                  }
                }}
              />
            )}

            {step === "extracting" && (
              <ExtractionLoading
                role={targetRole}
                ready={ready}
                onDone={() => setStep("review")}
              />
            )}

            {step === "review" && resume && (
              <ReviewForm
                resume={resume}
                onChange={saveEdits}
                onNext={() => setStep("score")}
                saveStatus={saveStatus}
              />
            )}

            {step === "score" && resume && (
              <ScoreStep
                resume={resume}
                onResumeImproved={(next) => saveEdits(next)}
                onNext={() => setStep("interview")}
              />
            )}

            {step === "interview" && resume && (
              <InterviewStep
                resume={resume}
                onNext={() => setStep("export")}
                onBack={() => setStep("score")}
              />
            )}

            {step === "export" && resume && (
              <ExportStep
                resume={resume}
                onChangeTemplate={(id) => saveEdits({ ...resume, templateId: id })}
                onBack={() => setStep("interview")}
              />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border/70 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>PauseResume · Pause. Refine. Resume.</span>
          <span>AI-generated — review before you submit.</span>
        </div>
      </footer>
    </div>
  );
}
