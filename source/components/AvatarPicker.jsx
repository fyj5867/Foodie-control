/**
 * Circular avatar with a picker, in the shape people already know from LINE.
 *
 * The picked image is centre-cropped to a square and scaled down before it is
 * stored, because it lives in the profile in localStorage alongside everything
 * else — a full phone photo would be megabytes and could push the whole store
 * over its quota, taking the health records down with it.
 *
 * With no picture set it falls back to the bean sprout, which keeps the empty
 * state on-brand and crisp at any size rather than showing a grey silhouette.
 */

import React, { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Sprout from "./Sprout.jsx";

/** Stored edge length. 200px covers a 96px avatar on a 2x screen. */
export const AVATAR_SIZE = 200;
const AVATAR_QUALITY = 0.82;

/**
 * Centre-crop to a square and scale to AVATAR_SIZE.
 *
 * Centre-crop rather than letterbox: a circular frame with bars looks broken,
 * and for a portrait the middle is nearly always the subject.
 */
export function cropToSquare(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("圖片讀取失敗"));
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("檔案讀取失敗"));
    reader.readAsDataURL(file);
  });
}

/**
 * @param avatar    stored data URL, or empty
 * @param nickname  used for the alt text so screen readers say who this is
 * @param onChange  called with the cropped data URL, or "" when cleared
 * @param size      rendered diameter in px
 */
export default function AvatarPicker({ avatar, nickname, onChange, size = 88 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const square = await cropToSquare(raw);
      onChange(square);
    } catch (err) {
      setError(err.message || "換頭像失敗，請再試一次");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-frame" style={{ width: size, height: size }}>
        {avatar ? (
          <img src={avatar} alt={nickname ? `${nickname}的頭像` : "頭像"} />
        ) : (
          <div className="avatar-fallback" aria-hidden="true">
            <Sprout stage="sapling" vitality="fair" ground={false} />
          </div>
        )}

        <button
          type="button"
          className="avatar-edit"
          onClick={() => inputRef.current && inputRef.current.click()}
          disabled={busy}
          aria-label="更換頭像"
        >
          <Camera size={14} />
        </button>
      </div>

      <div className="avatar-actions">
        <button
          type="button"
          className="avatar-link"
          onClick={() => inputRef.current && inputRef.current.click()}
          disabled={busy}
        >
          {busy ? "處理中…" : avatar ? "更換頭像" : "選一張照片"}
        </button>
        {avatar ? (
          <button type="button" className="avatar-link avatar-link-quiet" onClick={() => onChange("")}>
            <Trash2 size={12} /> 移除
          </button>
        ) : null}
      </div>

      {error ? <div className="avatar-error">{error}</div> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="avatar-input"
        onChange={(e) => handleFile(e.target.files && e.target.files[0])}
      />
    </div>
  );
}
