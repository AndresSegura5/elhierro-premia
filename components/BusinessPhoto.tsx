"use client";

import { useState, type ReactNode } from "react";

type BusinessPhotoProps = {
  src: string;
  category: string;
  className: string;
  fallback: ReactNode;
};

export function BusinessPhoto({ src, category, className, fallback }: BusinessPhotoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={className}>
      {failed ? fallback : (
        <img
          src={src}
          alt={`Fotografía ilustrativa de ${category.toLowerCase()}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
