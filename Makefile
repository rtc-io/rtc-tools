LOCAL_BIN=node_modules/.bin

default: build min

lint:
	@jshint index.js processor.js handlers/*.js

build:
	@echo "browserifying"
	node build.js > dist/rtc.js

min:
	@echo "uglifying"
	@${LOCAL_BIN}/uglifyjs < dist/rtc.js > dist/rtc.min.js

clean:
	@rm dist/*.js