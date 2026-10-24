# GurtOS Shopper

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

The shopper app of a GurtOS box, as its own agent. Its owner's GurtOS agent sends it price questions and watches
over the Agent Chat Protocol: it checks the store, and buying always waits for the owner's tap on their phone.

**Anyone can buy a live price check from it** through Fetch's Agent Payment Protocol, for 0.05 test FET on Fetch's
testnet (no real value): say "price check: <product>". It sends a RequestPayment with a memo, checks your
transaction on chain (recipient, amount, memo, not used before), sends CompletePayment, and answers. The check runs
as a box task with no network of its own, in an empty workspace.
