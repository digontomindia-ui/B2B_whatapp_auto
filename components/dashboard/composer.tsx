"use client";

import React, { useState } from "react";
import {
  Send,
  Paperclip,
  Layers,
  Loader2,
  Image as ImageIcon,
  FileText,
  Video,
  Music
} from "lucide-react";
import { toast } from "sonner";

interface ComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendMedia: (payload: {
    type: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
    mediaLink?: string;
    caption?: string;
    fileName?: string;
  }) => Promise<void>;
  onOpenTemplate: () => void;
  disabled?: boolean;
}

export function Composer({
  onSendText,
  onSendMedia,
  onOpenTemplate,
  disabled = false
}: ComposerProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaType, setMediaType] = useState<
    "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO"
  >("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");

  async function handleSend() {
    if (!text.trim() || isSending || disabled) return;
    const toSend = text.trim();
    setText("");
    setIsSending(true);

    try {
      await onSendText(toSend);
    } catch {
      toast.error("Failed to send message");
      setText(toSend); // Restore text on failure
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleMediaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaUrl.trim()) {
      toast.error("Please enter a media URL");
      return;
    }

    setIsSending(true);
    setShowMediaModal(false);

    try {
      await onSendMedia({
        type: mediaType,
        mediaLink: mediaUrl.trim(),
        caption: mediaCaption.trim() || undefined,
        fileName: mediaFileName.trim() || undefined
      });
      setMediaUrl("");
      setMediaCaption("");
      setMediaFileName("");
    } catch {
      toast.error("Failed to send media");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="relative">
      {/* Media Attachment Modal */}
      {showMediaModal && (
        <div className="border-border bg-card absolute bottom-14 left-0 z-30 w-80 space-y-3 rounded-lg border p-4 text-xs shadow-lg">
          <div className="border-border flex items-center justify-between border-b pb-2">
            <span className="text-foreground font-semibold">Attach Media</span>
            <button
              onClick={() => setShowMediaModal(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setMediaType("IMAGE")}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1.5 text-xs ${
                mediaType === "IMAGE"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <ImageIcon className="size-3" />
              Image
            </button>

            <button
              type="button"
              onClick={() => setMediaType("VIDEO")}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1.5 text-xs ${
                mediaType === "VIDEO"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Video className="size-3" />
              Video
            </button>

            <button
              type="button"
              onClick={() => setMediaType("AUDIO")}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1.5 text-xs ${
                mediaType === "AUDIO"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Music className="size-3" />
              Audio
            </button>

            <button
              type="button"
              onClick={() => setMediaType("DOCUMENT")}
              className={`flex cursor-pointer items-center justify-center gap-1 rounded border py-1.5 text-xs ${
                mediaType === "DOCUMENT"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <FileText className="size-3" />
              Doc
            </button>
          </div>

          <form onSubmit={handleMediaSubmit} className="space-y-2">
            <div>
              <label className="text-muted-foreground text-[11px] font-medium">
                Public Media URL (HTTPS)
              </label>
              <input
                type="url"
                required
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={
                  mediaType === "IMAGE"
                    ? "https://example.com/banner.png"
                    : mediaType === "VIDEO"
                      ? "https://example.com/demo.mp4"
                      : mediaType === "AUDIO"
                        ? "https://example.com/voice.ogg"
                        : "https://example.com/brochure.pdf"
                }
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            {mediaType === "DOCUMENT" && (
              <div>
                <label className="text-muted-foreground text-[11px] font-medium">
                  File Name
                </label>
                <input
                  type="text"
                  value={mediaFileName}
                  onChange={(e) => setMediaFileName(e.target.value)}
                  placeholder="Admission_Brochure_2026.pdf"
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-muted-foreground text-[11px] font-medium">
                Caption (optional)
              </label>
              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Here is your requested information..."
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-cf-orange mt-1 w-full rounded border px-2.5 py-1.5 text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="text-muted-foreground hover:bg-muted cursor-pointer rounded px-2.5 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-cf-orange cursor-pointer rounded px-3 py-1 text-xs font-semibold text-white hover:bg-[#e87516]"
              >
                Attach &amp; Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Composer Row */}
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => setShowMediaModal((prev) => !prev)}
            disabled={disabled || isSending}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-50"
            title="Attach Media"
          >
            <Paperclip className="size-4" />
          </button>

          <button
            type="button"
            onClick={onOpenTemplate}
            disabled={disabled || isSending}
            className="text-muted-foreground hover:bg-muted hover:text-cf-orange flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:opacity-50"
            title="Send WhatsApp Template"
          >
            <Layers className="size-4" />
          </button>
        </div>

        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            rows={1}
            placeholder="Type a message (Enter to send, Shift+Enter for new line)..."
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-cf-orange focus:ring-cf-orange max-h-32 min-h-[38px] w-full resize-none rounded-lg border px-3 py-2 text-xs focus:ring-1 focus:outline-none disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="bg-cf-orange flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-2xs transition-colors hover:bg-[#e87516] active:bg-[#d96b13] disabled:cursor-not-allowed disabled:opacity-50"
          title="Send"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="ml-0.5 size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
