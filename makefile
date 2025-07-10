ENV          ?= dev
HUGO         = hugo
MAX_JPG_SIZE = 250
MAX_WIDTH    = 1400
PNG_LEVEL    = 4
SHELL        := /bin/bash
TERRAFORM    = terraform -chdir="./terraform/env/$(ENV)"
# Determine the current live path from Terraform output, default to "blue"
CURRENT_LIVE_PATH := $(shell $(TERRAFORM) output -raw live_path 2>/dev/null || echo "blue")
NEXT_DEPLOY_PATH   = $(if $(filter blue,$(CURRENT_LIVE_PATH)),green,blue)

REQUIRED_BINS := hugo terraform aws exiftool jpegoptim optipng mogrify cwebp
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),,$(error Please install `$(bin)`)))

all: build optimize deploy promote invalidate

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

validate:
	$(TERRAFORM) validate

plan:
	$(TERRAFORM) plan -var="live_path=$(CURRENT_LIVE_PATH)"

apply:
	$(TERRAFORM) apply -auto-approve -var="live_path=$(CURRENT_LIVE_PATH)"

deploy: build optimize
	@echo ">>> Deploying to standby path: $(NEXT_DEPLOY_PATH)"
	aws s3 sync --delete public/ s3://$(shell $(TERRAFORM) output -raw bucket_name)/$(NEXT_DEPLOY_PATH)/

promote:
	@echo ">>> Promoting standby path '$(NEXT_DEPLOY_PATH)' to live"
	$(TERRAFORM) apply -auto-approve -var="live_path=$(NEXT_DEPLOY_PATH)"

release: promote invalidate

destroy:
	$(TERRAFORM) apply -destroy -auto-approve

invalidate:
	@echo ">>> Invalidating CloudFront cache"
	distribution_id=$$($(TERRAFORM) output -raw cloudfront_distribution_id); \
	aws cloudfront create-invalidation \
		--distribution-id $$distribution_id \
		--paths "/*" \
		--query "Invalidation.Id" \
		--output text
