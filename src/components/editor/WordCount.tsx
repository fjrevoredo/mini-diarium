interface WordCountProps {
  count: number;
}

export default function WordCount(props: WordCountProps) {
  return (
    <div class="text-sm text-gray-600">
      {props.count} {props.count === 1 ? 'word' : 'words'}
    </div>
  );
}
