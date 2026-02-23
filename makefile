ENV          ?= dev
HUGO         = hugo
MAX_JPG_SIZE = 250
MAX_WIDTH    = 1400
PNG_LEVEL    = 4
SHELL        := /bin/bash
TERRAFORM    = terraform -chdir="./terraform/env/$(ENV)"
# Determine the current live path from Terraform output, default to "blue"
# Only get live_path for environments that have it (not global)
CURRENT_LIVE_PATH := $(shell if [ "$(ENV)" != "global" ]; then $(TERRAFORM) output -raw live_path 2>/dev/null || echo "blue"; else echo "blue"; fi)
NEXT_DEPLOY_PATH   = $(if $(filter blue,$(CURRENT_LIVE_PATH)),green,blue)

REQUIRED_BINS := hugo terraform aws exiftool jpegoptim optipng mogrify cwebp
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),,$(error Please install `$(bin)`)))

all: validate build optimize deploy promote invalidate

build:
	$(HUGO) --gc --minify

optimize: exif

exif:
	exiftool -all= public/images* -overwrite_original

# compress:
# 	for i in public/images/*; do \
# 		mogrify -resize '$(MAX_WIDTH)>' "$$i" ; \
# 		if [[ "$$i" == *png ]]; then \
# 			optipng -f4 -clobber -strip all -o $(PNG_LEVEL) -quiet "$$i" ; \
# 		fi ; \
# 		if [[ "$$i" == *jp ]]; then \
# 			jpegoptim --strip-all --size=$(MAX_JPG_SIZE) -quiet "$$i" ; \
# 		fi ; \
# 	done

serve:
	$(HUGO) server -D

init:
	$(TERRAFORM) init

validate: validate-content
	$(TERRAFORM) validate

validate-content:
	python3 scripts/validate_frontmatter.py

plan:
	@if [ "$(ENV)" = "global" ]; then \
		$(TERRAFORM) plan; \
	else \
		$(TERRAFORM) plan -var="live_path=$(CURRENT_LIVE_PATH)"; \
	fi

apply:
	@if [ "$(ENV)" = "global" ]; then \
		$(TERRAFORM) apply -auto-approve; \
	else \
		$(TERRAFORM) apply -auto-approve -var="live_path=$(CURRENT_LIVE_PATH)"; \
	fi

deploy: build optimize
	@echo ">>> Deploying to standby path: $(NEXT_DEPLOY_PATH)"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping deployment for global environment"; \
	else \
		aws s3 sync --delete public/ s3://$(shell $(TERRAFORM) output -raw bucket_name)/$(NEXT_DEPLOY_PATH)/; \
	fi

promote:
	@echo ">>> Promoting standby path '$(NEXT_DEPLOY_PATH)' to live"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping promotion for global environment"; \
	else \
		$(TERRAFORM) apply -auto-approve -var="live_path=$(NEXT_DEPLOY_PATH)"; \
	fi

release: promote invalidate

destroy:
	$(TERRAFORM) apply -destroy -auto-approve

invalidate:
	@echo ">>> Invalidating CloudFront cache"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping cache invalidation for global environment"; \
	else \
		distribution_id=$$($(TERRAFORM) output -raw cloudfront_distribution_id); \
		aws cloudfront create-invalidation \
			--distribution-id $$distribution_id \
			--paths "/*" \
			--query "Invalidation.Id" \
			--output text; \
	fi
