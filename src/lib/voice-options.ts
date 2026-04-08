export type VoiceOption = {
  id: string;
  label: string;
  gender: "female" | "male";
  note?: string;
};

export const FEMALE_VOICE_OPTIONS: VoiceOption[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", gender: "female", note: "very popular" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi", gender: "female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", gender: "female" },
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", gender: "female", note: "very natural" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte", gender: "female" },
];

export const MALE_VOICE_OPTIONS: VoiceOption[] = [
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", gender: "male", note: "most popular" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", gender: "male" },
  { id: "VR6AewLTigWG4xSOukaG", label: "Arnold", gender: "male" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", gender: "male", note: "British tone" },
  { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam", gender: "male" },
];

export const DEFAULT_FEMALE_VOICE_ID = FEMALE_VOICE_OPTIONS[3].id;
export const DEFAULT_MALE_VOICE_ID = MALE_VOICE_OPTIONS[0].id;

export const findVoiceOption = (voiceId?: string | null) =>
  [...FEMALE_VOICE_OPTIONS, ...MALE_VOICE_OPTIONS].find((voice) => voice.id === voiceId) ?? null;
