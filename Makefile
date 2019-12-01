#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#

#
# Copyright 2019 Joyent, Inc.
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

NAME       := mackerel

#
# Tools
#
NODEUNIT        := ./node_modules/.bin/nodeunit
NPM             := npm

#
# Files
#
DOC_FILES        = index.md
BASH_FILES      := $(shell find bin -name '*.sh') $(shell find assets/bin -type f)
JS_FILES        := $(shell find assets/lib bin lib test \
    -name '*.js' -type f -not -name test.js)
JSL_CONF_NODE    = tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES    = $(JS_FILES)
JSSTYLE_FLAGS    = -f tools/jsstyle.conf


NODE_PREBUILT_VERSION=v0.10.48
NODE_PREBUILT_TAG=zone
# We want the sdc-smartos@1.6.3 builds of sdcnode. This should match the
# origin image used for "mola", in which mackerel is run. See the compatibility
# matrix here:
# 	https://github.com/joyent/triton-origin-image/blob/master/README.md#sdcnode-compatibility-with-triton-origin-images
NODE_PREBUILT_IMAGE=fd2cc906-8938-11e3-beab-4359c665ac99

ENGBLD_REQUIRE := $(shell git submodule update --init deps/eng)
include ./deps/eng/tools/mk/Makefile.defs
TOP ?= $(error Unable to access eng.git submodule Makefiles.)

include ./deps/eng/tools/mk/Makefile.node_prebuilt.defs
include ./deps/eng/tools/mk/Makefile.smf.defs

#
# MG Variables
#

RELEASE_TARBALL         := $(NAME)-pkg-$(STAMP).tar.gz
ROOT                    := $(shell pwd)
RELSTAGEDIR             := /tmp/$(NAME)-$(STAMP)

#
# Repo-specific targets
#
.PHONY: all
all: $(SMF_MANIFESTS) | $(NODEUNIT) $(REPO_DEPS) assets
	$(NPM) rebuild

$(NODEUNIT): | $(NPM_EXEC)
	$(NPM) install

CLEAN_FILES += $(NODEUNIT) ./node_modules/nodeunit

.PHONY: test
test: $(NODEUNIT)
	(cd test && NODE_EXEC=../$(NODE_EXEC) make test)

.PHONY: mycheck
mycheck:
	json --validate -f etc/config.json
	json --validate -f etc/jobs.json

check:: mycheck $(NODE_EXEC)

.PHONY: release
release: all docs $(SMF_MANIFESTS)
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)
	@mkdir -p $(RELSTAGEDIR)/root
	@mkdir -p $(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/etc
	cp -r	$(ROOT)/assets \
		$(ROOT)/build \
		$(ROOT)/bin \
		$(ROOT)/etc \
		$(ROOT)/lib \
		$(ROOT)/sapi_manifests \
		$(ROOT)/scripts \
		$(ROOT)/node_modules \
		$(ROOT)/package.json \
		$(RELSTAGEDIR)/root/opt/smartdc/$(NAME)/
	(cd $(RELSTAGEDIR) && $(TAR) -I pigz -cf $(ROOT)/$(RELEASE_TARBALL) root)
	@rm -rf $(RELSTAGEDIR)


.PHONY: publish
publish: release
	@if [[ -z "$(ENGBLD_BITS_DIR)" ]]; then \
		echo "error: 'ENGBLD_BITS_DIR' must be set for 'publish' target"; \
		exit 1; \
	fi
	mkdir -p $(ENGBLD_BITS_DIR)/$(NAME)
	cp $(ROOT)/$(RELEASE_TARBALL) $(ENGBLD_BITS_DIR)/$(NAME)/$(RELEASE_TARBALL)

.PHONY: assets
assets: $(NODEUNIT)
	gtar -zcf $(ROOT)/assets/node_modules.tar node_modules build/node/bin/node


include ./deps/eng/tools/mk/Makefile.deps
include ./deps/eng/tools/mk/Makefile.node_prebuilt.targ
include ./deps/eng/tools/mk/Makefile.smf.targ
include ./deps/eng/tools/mk/Makefile.targ
