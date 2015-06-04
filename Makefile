#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright (c) 2014, Joyent, Inc.
#

#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

REPO_NAME       := mackerel

#
# Tools
#
NPM             := npm

#
# Files
#
DOC_FILES        = index.md
BASH_FILES      := $(shell find bin -name '*.sh') $(shell find assets/bin -type f)
JS_FILES        := $(shell find assets/lib bin cmd -name '*.js' -type f)
JSL_CONF_NODE    = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES    = $(JS_FILES)
JSSTYLE_FLAGS    = -f tools/jsstyle.conf


NODE_PREBUILT_IMAGE=fd2cc906-8938-11e3-beab-4359c665ac99
NODE_PREBUILT_VERSION=v0.10.32
NODE_PREBUILT_TAG=zone


include ./tools/mk/Makefile.defs
include ./tools/mk/Makefile.node_prebuilt.defs
include ./tools/mk/Makefile.node_deps.defs
include ./tools/mk/Makefile.smf.defs

#
# MG Variables
#

RELEASE_TARBALL         := $(REPO_NAME)-pkg-$(STAMP).tar.bz2
ROOT                    := $(shell pwd)
RELSTAGEDIR             := /tmp/$(STAMP)

#
# Repo-specific targets
#
.PHONY: all
all: $(SMF_MANIFESTS) | $(REPO_DEPS) assets chronos
	$(NPM) install

DISTCLEAN_FILES += node_modules

.PHONY: test
test:
	(cd test && make test)

.PHONY: release
release: all docs $(SMF_MANIFESTS)
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/$(REPO_NAME)
	@mkdir -p $(RELSTAGEDIR)/root
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/$(REPO_NAME)/etc
	cp -r	$(ROOT)/assets \
		$(ROOT)/build \
		$(ROOT)/bin \
		$(ROOT)/chronos \
		$(ROOT)/cmd \
		$(ROOT)/etc \
		$(ROOT)/sapi_manifests \
		$(ROOT)/scripts \
		$(ROOT)/node_modules \
		$(ROOT)/package.json \
		$(RELSTAGEDIR)/root/opt/smartdc/$(REPO_NAME)/
	cp -r $(ROOT)/inputfuncs $(RELSTAGEDIR)/root/opt/smartdc/$(REPO_NAME)/chronos
	cp -r $(ROOT)/jobfuncs $(RELSTAGEDIR)/root/opt/smartdc/$(REPO_NAME)/chronos
	(cd $(RELSTAGEDIR) && $(TAR) -jcf $(ROOT)/$(RELEASE_TARBALL) root)
	@rm -rf $(RELSTAGEDIR)


.PHONY: publish
publish: release
	@if [[ -z "$(BITS_DIR)" ]]; then \
		@echo "error: 'BITS_DIR' must be set for 'publish' target"; \
		exit 1; \
	fi
	mkdir -p $(BITS_DIR)/$(REPO_NAME)
	cp $(ROOT)/$(RELEASE_TARBALL) $(BITS_DIR)/$(REPO_NAME)/$(RELEASE_TARBALL)

.PHONY: assets
assets:
	tar -zcf $(ROOT)/assets/node_modules.tar node_modules build/node/bin/node

.PHONY: chronos
chronos:
	cd chronos && make

include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.node_prebuilt.targ
include ./tools/mk/Makefile.node_deps.targ
include ./tools/mk/Makefile.smf.targ
include ./tools/mk/Makefile.targ
