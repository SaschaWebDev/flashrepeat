type SpeechCallback = (transcript: string, isFinal: boolean) => void;

interface SpeechSession {
  stop: () => void;
  isListening: boolean;
}

export function isSpeechSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function startSpeechRecognition(
  onResult: SpeechCallback,
  onEnd: () => void,
  lang = 'en-US',
): SpeechSession {
  const SpeechRecognition = (window as Record<string, unknown>).SpeechRecognition
    ?? (window as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error('Speech recognition not supported');
  }

  const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

  let listening = true;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
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
