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
