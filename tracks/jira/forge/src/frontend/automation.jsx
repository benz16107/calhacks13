// The settings form for the "Run in GurtOS" automation action. It has nothing to choose: the action always runs
// the rule's issue, passed as the smart value {{issue.key}}.
import React, { useEffect } from 'react';
import ForgeReconciler, { Button, Stack, Text } from '@forge/react';
import { view } from '@forge/bridge';

const use = () => view.submit({ issueKey: '{{issue.key}}' });

const App = () => {
  useEffect(() => {
    use();
  }, []);
  return (
    <Stack space="space.100">
      <Text>Starts a GurtOS agent task from the rule's issue. The agent works in its own space on the box, and its results, file changes and requests for an OK come back on the issue.</Text>
      <Button onClick={use}>Use the rule's issue</Button>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
