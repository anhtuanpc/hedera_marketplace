# Hedera marketplace contracts

This is 4 steps to deploy and test all smart contacts on hedera testnet

- Step 1: build smart contracts

```
make build
```

- Step 2: deploy all contract to testnet

```
make deploy
```

- Step 3: Copy all deployed contract ID to ./src/const.ts file with corresponding variables.

- Step 4: Run test for each contract or you can test all contracts at the same time.

```
make test-all
make test-nft
make test-token
make test-marketplace
make test-auction
```
