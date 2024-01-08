ENV          ?= dev
HUGO         = hugo
MAX_JPG_SIZE = 250
MAX_WIDTH    = 1400
PNG_LEVEL    = 4
SHELL        := /bin/bash
TERRAFORM    = terraform -chdir="./terraform/env/$(ENV)"

REQUIRED_BINS := hugo terraform aws exiftool jpegoptim optipng mogrify cwebp
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),,$(error Please install `$(bin)`)))

all: build optimize deploy invalidate

build:
	$(HUGO) --gc --minify

optimize: exif webp

exif:
	exiftool -all= public/images* -overwrite_original

webp:
	for image in static/images/*.png; do \
		webp_image="$${image%.*}.webp"; \
		if [[ ! -f "$$webp_image" || "$$image" -nt "$$webp_image" ]]; then \
			cwebp -q 75 "$$image" -o "$$webp_image"; \
		fi; \
	done
	for image in static/images/*.jpg; do \
		webp_image="$${image%.*}.webp"; \
		if [[ ! -f "$$webp_image" || "$$image" -nt "$$webp_image" ]]; then \
			cwebp -q 75 "$$image" -o "$$webp_image"; \
		fi; \
	done

serve:
	$(HUGO) server -D

init:
	$(TERRAFORM) init

validate:
	$(TERRAFORM) validate

plan:
	$(TERRAFORM) plan

apply:
	$(TERRAFORM) apply -auto-approve

deploy: init validate plan apply

destroy:
	$(TERRAFORM) apply -destroy -auto-approve

invalidate:
	distribution_id=$$($(TERRAFORM) output -raw cloudfront_distribution_id); \
	aws cloudfront create-invalidation \
		--distribution-id $$distribution_id \
		--paths "/*" \
		--query "Invalidation.Id" \
		--output text
