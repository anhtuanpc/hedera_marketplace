build:
	rm -rf ./artifact
	cp -r ./contracts ./artifact
	npx solcjs --bin ./artifact/RLF_Auction.sol --output-dir ./artifact \
    && npx solcjs --bin ./artifact/RLF_Marketplace.sol --output-dir ./artifact \
	&& npx solcjs --bin ./artifact/RLF_NFT.sol --output-dir ./artifact \
	&& npx solcjs --bin ./artifact/RLF_REAL.sol --output-dir ./artifact

deploy:
	ts-node ./src/script.ts

test-all:
	npm run test test/**.ts

test-nft:
	npm run test test/nft.test.ts

test-token:
	npm run test test/token.test.ts

test-marketplace:
	npm run test test/marketplace.test.ts

test-auction:
	npm run test test/auction.test.ts