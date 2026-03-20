import { v4 as uuidv4 } from 'uuid';
import type { CardContent } from '../types';

export function textToCardContent(text: string): CardContent {
  return {
    elements: [
      {
        id: uuidv4(),
        type: 'text',
        x: 5,
        y: 5,
        width: 90,
        height: 90,
        zIndex: 1,
        content: text,
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
        color: '#e8e8f0',
      },
    ],
  };
}

/**
 * Convert parsed Anki field content (text + image references) into CardContent.
 * Lays out text and images based on what's present.
 */
export function ankiFieldToCardContent(
  text: string,
  imageRefs: string[],
  mediaMap: Map<string, string>,
): CardContent {
  const resolvedImages = imageRefs
    .map((ref) => mediaMap.get(ref))
    .filter((url): url is string => url !== undefined);

  const hasText = text.trim().length > 0;
  const hasImages = resolvedImages.length > 0;

  // Text only — same as textToCardContent
  if (hasText && !hasImages) {
    return textToCardContent(text);
  }

  // Image only — single image fills the card
  if (!hasText && hasImages) {
    if (resolvedImages.length === 1) {
      return {
        elements: [
          {
            id: uuidv4(),
            type: 'image',
            x: 5,
            y: 5,
            width: 90,
            height: 90,
            zIndex: 1,
            content: resolvedImages[0],
          },
        ],
      };
    }
    // Multiple images, no text — tile them
    return {
      elements: tileImages(resolvedImages, 0, 100),
    };
  }

  // Text + 1 image — stacked layout
  if (hasText && resolvedImages.length === 1) {
    return {
      elements: [
        {
          id: uuidv4(),
          type: 'text',
          x: 5,
          y: 5,
          width: 90,
          height: 45,
          zIndex: 1,
          content: text,
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          color: '#e8e8f0',
        },
        {
          id: uuidv4(),
          type: 'image',
          x: 5,
          y: 50,
          width: 90,
          height: 45,
          zIndex: 2,
          content: resolvedImages[0],
        },
      ],
    };
  }

  // Text + N images — text on top, images tiled below
  if (hasText && resolvedImages.length > 1) {
    return {
      elements: [
        {
          id: uuidv4(),
          type: 'text',
          x: 5,
          y: 5,
          width: 90,
          height: 30,
          zIndex: 1,
          content: text,
          fontSize: 14,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          color: '#e8e8f0',
        },
        ...tileImages(resolvedImages, 35, 60),
      ],
    };
  }

  // Fallback: empty content
  return { elements: [] };
}

function tileImages(
  urls: string[],
  yStart: number,
  availableHeight: number,
): CardContent['elements'] {
  const cols = urls.length <= 2 ? urls.length : Math.min(3, urls.length);
  const rows = Math.ceil(urls.length / cols);
  const imgWidth = Math.floor(90 / cols);
  const imgHeight = Math.floor(availableHeight / rows);

  return urls.map((url, i) => ({
    id: uuidv4(),
    type: 'image' as const,
    x: 5 + (i % cols) * imgWidth,
    y: yStart + Math.floor(i / cols) * imgHeight,
    width: imgWidth,
    height: imgHeight,
    zIndex: i + 2,
    content: url,
  }));
}
