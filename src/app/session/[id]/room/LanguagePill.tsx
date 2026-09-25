"use client";

import { PICKER_LANGUAGES, getLanguageByCode } from "@/lib/languages";
import { ChevronDownIcon, GlobeIcon } from "./icons";

export default function LanguagePill({
  value,
  onChange,
}: {
  value: string;
  onChange: (lang: string) => void;
}) {
  const current = getLanguageByCode(value);

  return (
    <label className="jitsi-language-control" title="Translation language">
      <span className="jitsi-language-icon"><GlobeIcon /></span>
      <span className="jitsi-language-copy">
        <span className="jitsi-language-label">Translate to</span>
        <span className="jitsi-language-name">
          {current?.flag} {current?.name ?? "Language"}
        </span>
      </span>
      <span className="jitsi-language-chevron"><ChevronDownIcon /></span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Translation language"
      >
        {PICKER_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}
