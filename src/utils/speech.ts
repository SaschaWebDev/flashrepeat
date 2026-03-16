type SpeechCallback = (transcript: string, isFinal: boolean) => void;

interface SpeechSession {
  stop: () => void;
  isListening: boolean;
}

interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechCtor(): (new () => any) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => any) // eslint-disable-line @typescript-eslint/no-explicit-any
    | undefined;
}

export function isSpeechSupported(): boolean {
  return getSpeechCtor() !== undefined;
}

export function startSpeechRecognition(
  onResult: SpeechCallback,
  onEnd: () => void,
  lang = 'en-US',
): SpeechSession {
  const Ctor = getSpeechCtor();

  if (!Ctor) {
    throw new Error('Speech recognition not supported');
  }

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

  let listening = true;

  recognition.onresult = (event: { resultIndex: number; results: SpeechResult[] }) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onend = () => {
    listening = false;
    onEnd();
  };

  recognition.onerror = () => {
    listening = false;
    onEnd();
  };

  recognition.start();

  return {
    stop: () => {
      listening = false;
      recognition.stop();
    },
    get isListening() {
      return listening;
    },
  };
}
