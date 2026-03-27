import { useI18n } from '../../i18n';

interface WordCountProps {
  count: number;
}

export default function WordCount(props: WordCountProps) {
  const t = useI18n();
  return (
    <div class="text-sm text-secondary">
      {t(props.count === 1 ? 'editor.wordCount_one' : 'editor.wordCount_other', {
        count: props.count,
      })}
    </div>
  );
}
