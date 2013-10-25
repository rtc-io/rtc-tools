MODULE_NAME=rtc
LOCAL_BIN=node_modules/.bin
REQUIRED_TOOLS=uglifyjs st inotifywait

PHONY: dist

$(REQUIRED_TOOLS):
	@hash $@ 2>/dev/null || (echo "please install $@" && exit 1)

dist: $(REQUIRED_TOOLS)
	@mkdir -p dist

	@echo "building"
	@node build.js > dist/$(MODULE_NAME).js
	@browserify index.js > dist/$(MODULE_NAME).js --debug --standalone $(MODULE_NAME)

	@echo "minifying"
	@uglifyjs dist/$(MODULE_NAME).js > dist/$(MODULE_NAME).min.js 2>/dev/null

devmode: dist
	st --port 8000 --no-cache &

	while true; do inotifywait -e create -e delete -e modify -q -r *.js node_modules || make dist; done