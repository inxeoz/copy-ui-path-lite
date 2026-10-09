# copy-ui-path-lite — build helpers
#
# Layout:
#   firefox/   Manifest V2 extension  (Firefox / AMO)
#   chromium/  Manifest V3 extension  (Chrome / Edge / Chromium)
#   store/     store listing assets
#   dist/      build output (gitignored)
#
# Run `make` (or `make build`) to produce both packages in dist/.

DIST          := dist
FIREFOX_DIR   := firefox
CHROMIUM_DIR  := chromium

FIREFOX_NAME  := copy-ui-path-lite-firefox
CHROMIUM_NAME := copy-ui-path-lite-chromium

FIREFOX_VERSION  := $(shell python3 -c "import json;print(json.load(open('$(FIREFOX_DIR)/manifest.json'))['version'])" 2>/dev/null)
CHROMIUM_VERSION := $(shell python3 -c "import json;print(json.load(open('$(CHROMIUM_DIR)/manifest.json'))['version'])" 2>/dev/null)

ZIP_EXCLUDES := -x "*.git*" -x "*.DS_Store" -x "*.md"

.PHONY: all build check-versions sync firefox chromium chrome clean lint run-firefox version help

all: build

## build both packages
build: check-versions firefox chromium

## check-versions — both manifests must carry the same version (firefox/ is the source of truth)
check-versions:
	@python3 -c "import json,sys; \
	f=json.load(open('$(FIREFOX_DIR)/manifest.json'))['version']; \
	c=json.load(open('$(CHROMIUM_DIR)/manifest.json'))['version']; \
	sys.exit('VERSION MISMATCH: firefox %s != chromium %s (run: make sync)' % (f,c)) if f!=c else print('version %s (firefox == chromium)' % f)"

## sync — shared source: pull picker.js, icons and version from firefox/ into chromium/
sync:
	cp $(FIREFOX_DIR)/picker.js $(CHROMIUM_DIR)/picker.js
	rm -rf $(CHROMIUM_DIR)/icons && cp -r $(FIREFOX_DIR)/icons $(CHROMIUM_DIR)/icons
	@python3 -c "import json; \
	p='$(CHROMIUM_DIR)/manifest.json'; m=json.load(open(p)); \
	m['version']=json.load(open('$(FIREFOX_DIR)/manifest.json'))['version']; \
	f=open(p,'w'); f.write(json.dumps(m,indent=2)+chr(10)); f.close()"
	@echo "synced picker.js + icons + version: firefox/ -> chromium/"

## firefox  — build dist/copy-ui-path-lite-firefox-<version>.xpi (a zip; install via about:addons)
firefox:
	@mkdir -p $(DIST)
	@echo "Building Firefox extension v$(FIREFOX_VERSION)..."
	@cd $(FIREFOX_DIR) && zip -rq ../$(DIST)/$(FIREFOX_NAME)-$(FIREFOX_VERSION).xpi . $(ZIP_EXCLUDES)
	@echo "-> $(DIST)/$(FIREFOX_NAME)-$(FIREFOX_VERSION).xpi"

## chromium — build dist/copy-ui-path-lite-chromium-<version>.zip (unzip + Load unpacked, or upload to the store)
chromium:
	@mkdir -p $(DIST)
	@echo "Building Chromium extension v$(CHROMIUM_VERSION)..."
	@cd $(CHROMIUM_DIR) && zip -rq ../$(DIST)/$(CHROMIUM_NAME)-$(CHROMIUM_VERSION).zip . $(ZIP_EXCLUDES)
	@echo "-> $(DIST)/$(CHROMIUM_NAME)-$(CHROMIUM_VERSION).zip"

## chrome — alias for chromium
chrome: chromium

## lint — validate the Firefox build with web-ext (needs Node; runs via npx)
lint:
	npx --yes web-ext lint --source-dir $(FIREFOX_DIR)

## run-firefox — open the Firefox extension in a temporary profile (needs Node; runs via npx)
run-firefox:
	npx --yes web-ext run --source-dir $(FIREFOX_DIR)

## clean — remove build output
clean:
	rm -rf $(DIST) $(FIREFOX_DIR)/web-ext-artifacts $(CHROMIUM_DIR)/web-ext-artifacts

## version — print manifest versions
version:
	@echo "firefox  $(FIREFOX_VERSION)"
	@echo "chromium $(CHROMIUM_VERSION)"

help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
