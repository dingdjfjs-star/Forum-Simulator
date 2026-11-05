interface Props {
  floor: number;
  characterName: string;
  content: string;
}

export default function QuoteBox({ floor, characterName, content }: Props) {
  return (
    <div className="quote-box">
      <div className="text-xs text-gray-500 mb-1">
        引用 #{floor} {characterName}:
      </div>
      <div className="line-clamp-4 whitespace-pre-wrap break-words">
        {content}
      </div>
    </div>
  );
}
