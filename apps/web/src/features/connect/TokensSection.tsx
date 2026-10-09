import type { ApiToken } from '@tracker/shared';
import { errorMessage, type TrackerQuery } from '../../api';
import { useApiTokens } from '../../api/hooks/apiTokens';
import { Button, GroupedCard, Spinner } from '../../components';
import { useNow } from '../../lib/useNow';
import shared from './ConnectSheet.module.css';
import { NewToken } from './NewToken';
import { Section } from './Section';
import { TokenRow } from './TokenRow';
import styles from './Tokens.module.css';

function TokenList({ query }: { query: TrackerQuery<ApiToken[]> }) {
  const now = useNow();
  if (query.isPending) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading the tokens" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <>
        <p role="alert" className={shared.error}>
          {errorMessage(query.error)}
        </p>
        <Button size="sm" className={shared.retry} onClick={() => void query.refetch()}>
          Try again
        </Button>
      </>
    );
  }
  if (query.data.length === 0) return <p className={shared.note}>No tokens yet.</p>;
  return (
    <GroupedCard>
      <ul className={shared.rows} aria-label="Tokens">
        {query.data.map((token) => (
          <TokenRow key={token.id} token={token} now={now} />
        ))}
      </ul>
    </GroupedCard>
  );
}

export function TokensSection() {
  const tokens = useApiTokens();
  return (
    <Section title="API tokens">
      <p className={shared.help}>
        Claude Code signs in to this tracker with a token. Make one for each computer, and revoke it
        if it leaks.
      </p>
      <TokenList query={tokens} />
      <NewToken />
    </Section>
  );
}

export function OpenTrackerNote() {
  return (
    <Section title="API tokens">
      <p className={shared.note}>
        This tracker has no owner account, so it lets agents in without a token. Once you set one up
        with <code className={shared.inlineCode}>npm run owner:set</code>, make tokens here.
      </p>
    </Section>
  );
}
