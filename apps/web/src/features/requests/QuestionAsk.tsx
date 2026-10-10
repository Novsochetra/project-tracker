import type { RunQuestion } from '@tracker/shared';
import { MessageCircleQuestion } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import { Button } from '../../components';
import { QUESTION_HEAD, SEND_LABEL, SKIP_LABEL } from './copy';
import { QuestionBlock } from './QuestionBlock';
import { RequestHead } from './RequestHead';
import { revealActions } from './revealActions';
import {
  answersAtOnce,
  choiceAnswer,
  NO_PICK,
  noPicks,
  questionAnswers,
  SKIP,
  togglePick,
  typeOther,
  type QuestionPick,
} from './requestAnswers';
import styles from './Requests.module.css';
import type { Answer } from './useAnswer';

export interface QuestionAskProps {
  questions: RunQuestion[];
  answer: Answer;
}

export function QuestionAsk({ questions, answer }: QuestionAskProps) {
  const [picks, setPicks] = useState<QuestionPick[]>(() => noPicks(questions));
  const buttonsRef = useRef<HTMLDivElement>(null);
  const atOnce = answersAtOnce(questions);
  const ready = questionAnswers(picks);
  const setPick = (index: number, pick: QuestionPick) =>
    setPicks((all) => all.map((old, at) => (at === index ? pick : old)));
  const sendReady = (event?: MouseEvent<HTMLElement>) => {
    if (ready) answer.send(ready, event);
  };
  return (
    <>
      <RequestHead icon={MessageCircleQuestion} text={QUESTION_HEAD} />
      {questions.map((question, index) => {
        const pick = picks[index] ?? NO_PICK;
        const choose = (label: string, event?: MouseEvent<HTMLButtonElement>) => {
          setPick(index, togglePick(question, pick, label));
          if (atOnce) answer.send(choiceAnswer(label), event);
        };
        return (
          <QuestionBlock
            key={`${index}:${question.question}`}
            question={question}
            pick={pick}
            atOnce={atOnce}
            disabled={answer.pending}
            onChoose={choose}
            onOther={(text) => setPick(index, typeOther(question, pick, text))}
            onOtherFocus={() => revealActions(buttonsRef.current)}
            onEnter={() => sendReady()}
          />
        );
      })}
      <div ref={buttonsRef} className={styles.buttons}>
        <Button
          variant="primary"
          size="lg"
          disabled={!ready || answer.pending}
          onClick={(event) => sendReady(event)}
        >
          {SEND_LABEL}
        </Button>
        <Button
          variant="text"
          size="lg"
          disabled={answer.pending}
          onClick={(event) => answer.send(SKIP, event)}
        >
          {SKIP_LABEL}
        </Button>
      </div>
    </>
  );
}
