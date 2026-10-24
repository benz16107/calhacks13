---
title: Download GurtOS
description: Download the GurtOS v0.1.0-preview install images for GurtOS Server and GurtOS Personal, with checksums and how to verify them.
sidebar:
  label: Download
---

GurtOS v0.1.0-preview is being built and signed now. When it is published, this page lists each install image with
its direct link, its SHA-256 checksum, how to verify it, and which file fits which machine. The images will be on
[GitHub Releases](https://github.com/benz16107/calhacks13/releases), with a mirror.

Until then, you can build an image yourself from the source:

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos
cd gurtos
BUILD_SHELL='ssh my-build-vm' image/build            # GurtOS Server, x86_64
BUILD_SHELL='ssh my-build-vm' image/build personal   # GurtOS Personal, x86_64
```

The build runs on an Ubuntu 24.04 machine where you have root, not on your own computer. See
[Install GurtOS Server](/get-started/install-server/#get-the-iso) and
[Install GurtOS Personal](/get-started/install-personal/#get-the-iso) for the details, or
[install on Ubuntu](/get-started/install-on-ubuntu/) without building an image.

GurtOS is open source under the [Apache License 2.0](https://github.com/benz16107/calhacks13/blob/main/LICENSE).
