ENV          ?= prod
HUGO         = hugo
MAX_JPG_SIZE = 250
MAX_WIDTH    = 1400
PNG_LEVEL    = 4
SHELL        := /bin/bash
TOFU         = tofu -chdir="./terraform/env/$(ENV)"
CURRENT_LIVE_PATH = $(shell $(TOFU) output -raw live_path 2>/dev/null || true)
NEXT_DEPLOY_PATH   = $(if $(filter blue,$(CURRENT_LIVE_PATH)),green,blue)

REQUIRED_BINS := hugo tofu aws exiftool jpegoptim optipng mogrify cwebp
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),,$(error Please install `$(bin)`)))

all: validate build optimize deploy promote invalidate

build:
	$(HUGO) --gc --minify

optimize: exif

exif:
	exiftool -all= public/images* -overwrite_original

serve:
	$(HUGO) server -D

init:
	$(TOFU) init

init-readonly:
	$(TOFU) init -lockfile=readonly

validate: validate-content
	$(TOFU) validate

validate-content:
	python3 scripts/validate_frontmatter.py

plan:
	@if [ "$(ENV)" = "global" ]; then \
		$(TOFU) plan; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		$(TOFU) plan -var="live_path=$(CURRENT_LIVE_PATH)"; \
	fi

plan-out:
	@if [ "$(ENV)" = "global" ]; then \
		$(TOFU) plan -out="$(CURDIR)/$(ENV).tfplan"; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		$(TOFU) plan -var="live_path=$(CURRENT_LIVE_PATH)" -out="$(CURDIR)/$(ENV).tfplan"; \
	fi
	$(TOFU) show -no-color "$(CURDIR)/$(ENV).tfplan" > "$(CURDIR)/$(ENV).plan.txt"

refresh-plan:
	@if [ "$(ENV)" = "global" ]; then \
		$(TOFU) plan -refresh-only; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		$(TOFU) plan -refresh-only -var="live_path=$(CURRENT_LIVE_PATH)"; \
	fi

apply:
	@if [ "$(ENV)" = "global" ]; then \
		$(TOFU) apply -auto-approve; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		$(TOFU) apply -auto-approve -var="live_path=$(CURRENT_LIVE_PATH)"; \
	fi

deploy: build optimize
	@echo ">>> Deploying to standby path: $(NEXT_DEPLOY_PATH)"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping deployment for global environment"; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		aws s3 sync --delete public/ s3://$(shell $(TOFU) output -raw bucket_name)/$(NEXT_DEPLOY_PATH)/; \
	fi

promote:
	@echo ">>> Promoting standby path '$(NEXT_DEPLOY_PATH)' to live"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping promotion for global environment"; \
	else \
		$(MAKE) require-live-path ENV=$(ENV); \
		$(TOFU) apply -auto-approve -var="live_path=$(NEXT_DEPLOY_PATH)"; \
	fi

require-live-path:
	@if [ "$(ENV)" = "global" ]; then exit 0; fi; \
	path="$$($(TOFU) output -raw live_path 2>/dev/null)" || { echo "ERROR: unable to read live_path from $(ENV) state" >&2; exit 1; }; \
	case "$$path" in blue|green) ;; *) echo "ERROR: invalid live_path '$$path'" >&2; exit 1 ;; esac

release: promote invalidate

destroy:
	$(TOFU) apply -destroy -auto-approve

invalidate:
	@echo ">>> Invalidating CloudFront cache"
	@if [ "$(ENV)" = "global" ]; then \
		echo ">>> Skipping cache invalidation for global environment"; \
	else \
		distribution_id=$$($(TOFU) output -raw cloudfront_distribution_id); \
		aws cloudfront create-invalidation \
			--distribution-id $$distribution_id \
			--paths "/*" \
			--query "Invalidation.Id" \
			--output text; \
	fi
