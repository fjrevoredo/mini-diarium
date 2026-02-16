interface WordCountProps {
  count: number;
}

export default function WordCount(props: WordCountProps) {
  return (
    <div class="text-sm text-secondary">
      {props.count} {props.count === 1 ? 'word' : 'words'}
    </div>
  );
}
