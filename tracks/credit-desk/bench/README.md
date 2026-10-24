# Benchmark: DABstep dev split, run through GurtOS tasks

Hyphenate's submission asks for "proof (planted errors with an answer key, or a benchmark)". The credit desk has the
planted-error case (`../README.md`). This folder is the benchmark half: a public finance-agent benchmark, run through
the same box tasks the desk uses, with the scorer the benchmark's authors publish.

**Result: 7 of 10 correct** (2 of 3 easy, 5 of 7 hard), Droid with Claude Sonnet 4.6, one attempt per question, no network. It cost about $3.22 in list-price model spend and took 8 minutes of wall clock (11.8 minutes of task time, two tasks at a time). The 5-hour Factory limit went from 5% to 15%.

## Which benchmark, and why

Hyphenate suggested three. What each one publishes, checked on 2026-10-24:

| | Public questions | Public reference answers | Runs offline? | License | Used? |
|---|---|---|---|---|---|
| [DABstep](https://huggingface.co/datasets/adyen/DABstep) (Adyen and Hugging Face, [paper](https://arxiv.org/abs/2506.23719)) | 450 (72 easy, 378 hard) | Only the 10-question dev split. The 450 answers are withheld and scored on the leaderboard | Yes. The data is 7 files (payments.csv has 138,236 rows, 23 MB) and the scorer is one short Python file | CC BY 4.0 (dataset and [Space](https://huggingface.co/spaces/adyen/DABstep)) | **Yes** |
| [Finance Agent Benchmark](https://huggingface.co/datasets/vals-ai/finance_agent_benchmark) (Vals AI, [harness](https://github.com/vals-ai/finance-agent)) | 50 of 537 | Yes, but as paragraphs with a rubric of `correctness` criteria, which needs an LLM judge | No. The agent is built around live SEC EDGAR search (a sec-api.io key) and Tavily web search, and the harness needs a gated Vals platform key | Dataset CC BY 4.0, harness MIT | No |
| AccountingBench (Penrose, [post](https://accounting.penrose.com)) | None found | None found | No. It closes a year of one real SaaS company's Stripe, Ramp, Mercury and Rippling books against a CPA's. I found no dataset or code, and the post's page text did not load for me | n/a | No |

A GitHub repo also called AccountingBench (mkaburek-wu) is an unrelated academic project. Nothing here uses it.

DABstep fits the rest of this project. Its questions are what a finance team asks of its payments data: fees owed,
fraud rates, which fee rules apply. It needs no network, which matches the box (a task gets no hosts here). Its
answers are short, so the scorer is code and no model has to judge. And it has an answer key I am allowed to read.

## The slice

All 10 questions of the dev split (3 easy, 7 hard), the only ones whose answers are public. The 450 official questions
cannot be scored without the leaderboard, so this is a slice and not a leaderboard entry.

Every question gets the same 7 context files (`manual.md`, `payments-readme.md`, `payments.csv`, `fees.json`,
`merchant_data.json`, `merchant_category_codes.csv`, `acquirer_countries.csv`). The hard questions are the interesting
ones: they need the manual's fee rules applied row by row, for example "which fee IDs apply to Belles_cookbook_store in
March 2023".

Pinned revisions (also in `fetch.sh`, with file checksums in `SHA256SUMS`):

- dataset `adyen/DABstep` at `0545553f02cedc323dee8658af62555852bc3b24`
- scorer from the Space `adyen/DABstep` at `d4431c2e4a695cbe43c33aab2adaa304a37ae64a`

## How it was run

- **Worker and model.** The box's real worker, Droid, with `claude-sonnet-4-6` (the box default), through Factory.
- **One task per question**, titled `Benchmark <id>`, in its own workspace holding only `context/`. No question sees
  another's answer or files.
- **No network.** `hosts: []` and no tools. In the smoke test the box's proxy logged only DNS lookups to the local resolver,
  which it blocked. I did not save the other eight tasks' blocked-connection counts before stopping the box, so that
  check was made on the smoke test only. No Python packages beyond the standard library were available, so the prompt tells the agent so.
- **One attempt per question.** No retry, no best-of-n, no second prompt. A missing answer file scores as wrong.
- **The prompt** is the question, the benchmark's own answer-format guidelines for that question, a pointer to the
  files and the instruction to write only the final answer to `answer.txt`. It tells the agent to read the documentation first, as the benchmark's own baseline prompt does, and names no other method.
- **The answers are not on the agent's disk.** The questions with answers and the results sit in the bench box's
  root-only folder; the code the task user can read has neither.
- **Scoring.** `scorer.ts` is a line-for-line port of DABstep's `question_scorer`, called as the leaderboard calls it
  (`question_scorer(agent_answer, correct_answer)`, in `dabstep_benchmark/utils.py`). `scorer.test.ts` runs DABstep's
  own test cases, then compares the port with the original `data/scorer.py` on 4,000 random answer pairs, with zero
  differences. Two mutations of the port (breaking half-to-even rounding, breaking difflib's popular-character rule)
  make that test fail, so it does check them. Known differences from Python: `\d` matches ASCII digits only, and
  list items sort by UTF-16 unit and not by code point.
- **Usage guard.** Before starting, `run.ts` reads Factory's 5-hour usage the way `core/demo.ts` does and refuses to
  start at 60% or more. It checks once a minute while running, and at 75% it stops, cancels what is running and saves
  what finished. The 5-hour limit read 5% before the first question and 15% after the last.
- **Cost** is the box's list-price estimate from the token counts (`core/pricing.ts`). Factory bills in its own credits.

## Result

7 of 10 on 2026-10-24. The run was two files in `results/`: the 2-question smoke test (questions 5 and 1273, both passed), then the other 8. Each question was attempted once; `summarize.ts` refuses a question that appears twice. Every answer, the full reference and the token counts are in `results/*.json`.

| Question | Level | Reference | Agent answer | Result | Time | Cost |
|---|---|---|---|---|---|---|
| 5 | easy | `NL` | `NL` | pass | 15 s | $0.10 |
| 49 | easy | `B. BE` | `B. BE` | pass | 24 s | $0.09 |
| 70 | easy | `Not Applicable` | `yes` | FAIL | 37 s | $0.22 |
| 1273 | hard | `0.120132` | `0.120132` | pass | 27 s | $0.24 |
| 1305 | hard | `0.123217` | `0.123217` | pass | 39 s | $0.27 |
| 1464 | hard | `1, 2, 5, 6, 8, 9, 10, 12, 14, 15, 20, 21, 22, 23, 25, 30, 34...` | `34, 39, 49, 62, 68, 82, 154, 220, 231, 236, 265, 276, 278, 2...` | FAIL | 42 s | $0.21 |
| 1681 | hard | `741, 709, 454, 813, 381, 536, 473, 572, 477, 286` | `286, 381, 454, 473, 477, 536, 572, 709, 741, 813` | pass | 93 s | $0.41 |
| 1753 | hard | `384, 394, 276, 150, 536, 286, 163, 36, 680, 939, 428, 813, 5...` | `36, 51, 53, 64, 107, 123, 150, 163, 231, 249, 276, 286, 347,...` | pass | 87 s | $0.41 |
| 1871 | hard | `-0.94810300000017` | `-0.94810300000000` | pass | 66 s | $0.23 |
| 2697 | hard | `E:13.57` | `E:16.63` | FAIL | 277 s | $1.05 |

Summed over the 10 questions: 6,158 input tokens, 66,834 output tokens, 322,444 cache-write and 3,294,402 cache-read tokens. Task time is the sum of each task's own time, so it exceeds wall clock when two ran together.

What the three misses were, from the agent's own final message:

- **70 (easy).** The question asks whether a merchant is "in danger of getting a high-fraud rate fine". The manual describes fraud-rate fee tiers and no fine, so the reference is "Not Applicable". The merchant exists in the data, the agent computed its monthly fraud rates (7.9% to 10.9%) and answered "yes". It accepted the question's premise.
- **1464 (hard).** "Which fee IDs apply to account_type = R and aci = B?" The agent returned 50 IDs against a reference of about 370. It counted only fee rules that list R and B explicitly. It read that the manual says an empty list means "all values", then left those rules out anyway.
- **2697 (hard).** Fees if the fraudulent transactions moved to another ACI. The agent chose ACI E at 16.63, against 13.57. Its own table shows ACI E had a matching fee rule for only 44 of the 94 transactions, so it compared totals that cover different transactions. It took 277 s and $1.05, the longest and most expensive question.

How a pass is decided matters for two of the seven. In 1871 the agent answered `-0.94810300000000` and the reference is `-0.94810300000017`. The scorer passes it: its number pattern has no minus sign, and when both numbers are under 1 it accepts a difference within 1e-4. In 1681 and 1753 the fee IDs were in a different order than the reference's, which the scorer ignores because it sorts list items. Those are the benchmark's rules, and `scorer.ts` keeps them.

## Limits

- **Ten questions is a slice, not a score.** With 10 questions one answer moves the number by 10 points, and the 95%
  interval on 7 of 10 is 40% to 89% (Wilson). Do not compare it with the leaderboard, which grades all 450.
- **The dev split is public.** Its answers are on Hugging Face, so a model may have seen them in training. The agent
  had no network to look them up, and nothing here tells how much it remembered.
- **The dev questions are not a random sample.** They are the authors' examples: 3 easy and 7 hard, where the full
  set is 72 and 378.
- **This is a different harness from the paper's.** Those baselines are a smolagents ReAct loop with a step limit;
  this is Droid with its own tools and no step limit, on Claude Sonnet 4.6. A comparison of agents would need the
  same model and loop on both sides.
- **The task shares a VM.** Times and the 2-at-a-time concurrency are not a speed measure.
- **Scoring is the benchmark's, with its quirks.** A one-word answer passes if that word appears in the other string,
  numbers are compared to the precision of the shorter one, and a minus sign is ignored.

## Run it again

From this checkout, on the machine that hosts the test VM. Needs the test VM (`limactl`) and a Factory key in the VM's `/etc/box/vault.env`.

```sh
tracks/credit-desk/bench/fetch.sh                    # downloads data/ and checks SHA256SUMS
node --test tracks/credit-desk/bench/scorer.test.ts  # DABstep's scorer tests, and the comparison with scorer.py
tracks/credit-desk/bench/box.sh start                # a throwaway box on the VM: port 7798, /var/lib/box-bench
tracks/credit-desk/bench/box.sh run --ids 5,1273     # the 2-question smoke test (add --fake to test without a model)
tracks/credit-desk/bench/box.sh run                  # all 10 (--limit N, --concurrency N, --timeout-min N)
node tracks/credit-desk/bench/summarize.ts           # joins results/*.json into results/summary.json
tracks/credit-desk/bench/box.sh stop                 # kills the box, its tasks and users, deletes its data
```

`run.ts` refuses to run when Factory's 5-hour limit is at 60% or more (`--max-start`) and stops at 75% (`--stop-at`).
A second full run makes `summarize.ts` refuse, because a question would have two attempts; move the old
`results/*.json` away first.
Port 7798 and not 7797 because another dev box held 7797 on 2026-10-24.

## What is here

| Path | What it is |
|---|---|
| `fetch.sh`, `SHA256SUMS` | Downloads the pinned dataset files and the original scorer into `data/` (git-ignored), and checks them |
| `box.sh` | Starts and stops the throwaway bench box, and runs `run.ts` on the VM |
| `run.ts` | One Droid task per question, then scoring and the results file |
| `scorer.ts`, `scorer.test.ts` | The port of DABstep's scorer, and its tests |
| `summarize.ts` | Joins the runs into `results/summary.json` and prints the table above |
| `results/<run>.json` | One file per run: every question, the agent's answer, the reference, pass or fail, cost, tokens, tool calls and time, with the run's summary |
| `results/summary.json` | All runs together |
