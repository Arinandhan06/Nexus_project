import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Check,
  Lock,
  XCircle,
  HelpCircle,
  FolderPlus
} from "lucide-react";
import NexusPanel from "./NexusPanel";
import NexusButton from "./NexusButton";
import GlitchText from "./GlitchText";
import api from "../../lib/api";

export default function TrophyPanel({ currentUser, className = "" }) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  // Fetch trophy preview
  const fetchPreview = useCallback(async () => {
    try {
      setLoadingPreview(true);
      setErrorMsg(null);
      const res = await api.post("/trophy/preview");
      setPreviewData(res.data);
    } catch (err) {
      console.warn("Failed to fetch trophy preview:", err);
      setErrorMsg(
        err.response?.data?.detail || "Unable to inspect GitHub profile repository. Please check your GitHub session."
      );
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Claim Trophy execution with confirmation
  const handleClaimTrophy = async (createRepo = false) => {
    try {
      setClaiming(true);
      setShowConfirmModal(false);
      setErrorMsg(null);
      const res = await api.post("/trophy/claim", {
        confirm: true,
        create_repo_if_missing: createRepo,
      });
      setClaimResult(res.data);
      await fetchPreview();
    } catch (err) {
      console.error("Trophy claim failed:", err);
      setErrorMsg(err.response?.data?.detail || "Failed to commit trophy to GitHub.");
    } finally {
      setClaiming(false);
    }
  };

  const login = currentUser?.github_username || previewData?.repo_name?.split("/")[0] || "player";
  const repoUrl = `https://github.com/${login}/${login}`;

  return (
    <NexusPanel variant="neutral" className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 uppercase tracking-widest font-bold">
            <Shield size={14} />
            <span>GITHUB REPUTATION TROPHY // CONSENT-FIRST</span>
          </div>
          <GlitchText
            text="PROFILE README BADGE"
            className="text-xl sm:text-2xl font-bold text-white tracking-wide"
          />
          <p className="text-xs font-mono text-zinc-400">
            Showcase your completed Chamber Gauntlet on your GitHub profile README.
          </p>
        </div>

        <NexusButton variant="outline" size="sm" onClick={fetchPreview} icon={RefreshCw}>
          Sync Preview
        </NexusButton>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-red-400 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-zinc-400 hover:text-white">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Claim Success Banner */}
      {claimResult && (
        <div
          className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${
            claimResult.already_claimed
              ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
              : "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between font-bold text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>
                {claimResult.already_claimed
                  ? "TROPHY ALREADY CLAIMED"
                  : "TROPHY SUCCESSFULLY COMMITTED"}
              </span>
            </div>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white underline hover:text-cyan-300"
            >
              <span>View on GitHub</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <p className="text-[11px] text-zinc-300">{claimResult.message}</p>

          {/* GitHub Verification Status */}
          <div className="p-2.5 rounded bg-black/40 border border-zinc-800 text-[11px] flex items-center justify-between">
            <span className="text-zinc-400">
              GitHub Commit Verification:{" "}
              <strong className={claimResult.verified ? "text-emerald-400" : "text-amber-400"}>
                {claimResult.verified ? "VERIFIED" : "UNVERIFIED (Reported by GitHub)"}
              </strong>
            </span>
            <span className="text-zinc-500">Reason: {claimResult.verification_reason}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadingPreview && !previewData ? (
        <div className="p-8 text-center font-mono text-xs text-zinc-500 animate-pulse">
          // Inspecting GitHub profile repository {login}/{login}...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Missing Repo Notice */}
          {previewData && !previewData.repo_exists && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 font-mono text-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <FolderPlus size={16} />
                <span>Profile Repository {login}/{login} Not Found</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                GitHub profile READMEs reside in a special repository named exactly after your username.
                NEXUS will create <code className="text-amber-400 bg-black/40 px-1 py-0.5 rounded">{login}/{login}</code> with
                a README for you upon your confirmation.
              </p>
              <NexusButton
                variant="primary"
                size="sm"
                onClick={() => handleClaimTrophy(true)}
                disabled={claiming}
                icon={FolderPlus}
              >
                {claiming ? "Creating Repo & Claiming..." : `Create ${login}/${login} & Add Trophy`}
              </NexusButton>
            </div>
          )}

          {/* Badge Visual Preview */}
          <div className="p-4 rounded-xl bg-[#030712] border border-zinc-800 space-y-3 font-mono text-xs">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">
              // BADGE RENDER PREVIEW
            </span>
            <div className="p-4 rounded-lg bg-zinc-950/80 border border-zinc-800/80 flex flex-col items-center justify-center space-y-2 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <img
                  src="https://img.shields.io/badge/NEXUS-Code_Awakened-00f0ff?style=for-the-badge&logo=shield&logoColor=white"
                  alt="NEXUS: Code Awakened"
                  className="h-7"
                />
                <img
                  src="https://img.shields.io/badge/CHAMBERS-6%2F6-22c55e?style=for-the-badge"
                  alt="Chambers: 6/6"
                  className="h-7"
                />
                <img
                  src={`https://img.shields.io/badge/NXP-${currentUser?.total_nxp || 1500}-a855f7?style=for-the-badge`}
                  alt="Total NXP"
                  className="h-7"
                />
              </div>
              <div className="text-[11px] text-zinc-400 italic mt-1">
                "Concluded the adversarial coding simulation. All 6 Chambers conquered."
              </div>
            </div>
          </div>

          {/* Unified Diff Preview */}
          {previewData && (
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-bold">// README.md UNIFIED DIFF PREVIEW</span>
                <span>Byte-for-byte preservation guaranteed</span>
              </div>
              <div className="p-4 rounded-xl bg-[#030712] border border-zinc-800 overflow-x-auto max-h-56 text-[11px] leading-relaxed shadow-inner">
                {previewData.preview_diff ? (
                  <pre className="text-zinc-300 whitespace-pre">
                    {previewData.preview_diff.split("\n").map((line, idx) => {
                      if (line.startsWith("+")) {
                        return (
                          <span key={idx} className="text-emerald-400 block bg-emerald-950/20">
                            {line}
                          </span>
                        );
                      }
                      if (line.startsWith("-")) {
                        return (
                          <span key={idx} className="text-red-400 block bg-red-950/20">
                            {line}
                          </span>
                        );
                      }
                      if (line.startsWith("@")) {
                        return (
                          <span key={idx} className="text-cyan-400 block font-bold">
                            {line}
                          </span>
                        );
                      }
                      return (
                        <span key={idx} className="text-zinc-500 block">
                          {line}
                        </span>
                      );
                    })}
                  </pre>
                ) : (
                  <div className="text-zinc-500 italic">
                    // Trophy marker already in place. No changes required.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button & Confirmation Trigger */}
          {previewData?.repo_exists && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-zinc-800">
              <div className="text-[11px] font-mono text-zinc-500">
                Target: <code className="text-cyan-300 font-bold">{previewData.repo_name}/README.md</code>
              </div>

              <NexusButton
                variant="primary"
                size="md"
                onClick={() => setShowConfirmModal(true)}
                disabled={claiming || previewData.already_claimed}
                icon={previewData.already_claimed ? Check : GitCommit}
              >
                {claiming
                  ? "Writing to GitHub..."
                  : previewData.already_claimed
                  ? "Trophy Already in README"
                  : "Claim Trophy to GitHub"}
              </NexusButton>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <NexusPanel variant="neutral" className="max-w-md w-full p-6 space-y-4 border-purple-500/50 shadow-2xl">
            <div className="flex items-center gap-3 text-purple-400 font-mono text-sm font-bold">
              <HelpCircle size={20} />
              <span>CONFIRM PROFILE README UPDATE</span>
            </div>
            <p className="text-xs text-zinc-300 font-mono leading-relaxed">
              You are about to commit the NEXUS trophy block into your personal repository at{" "}
              <strong className="text-white">{login}/{login}/README.md</strong>.
              Only the marked block is touched; everything else remains byte-for-byte identical.
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 font-mono">
              <NexusButton variant="outline" size="sm" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </NexusButton>
              <NexusButton
                variant="primary"
                size="sm"
                onClick={() => handleClaimTrophy(false)}
                icon={Check}
              >
                Confirm & Commit
              </NexusButton>
            </div>
          </NexusPanel>
        </div>
      )}
    </NexusPanel>
  );
}
