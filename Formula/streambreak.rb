class Streambreak < Formula
  desc "Break time content during AI coding waits"
  homepage "https://github.com/rhc98/streambreak"
  version "0.2.0"
  url "https://github.com/rhc98/streambreak/releases/download/v0.2.0/streambreak-universal-apple-darwin.tar.gz"
  sha256 "f4b8ce22902cf006097ac5bbd2be7c189a457538c2f9884e20b337f7672db41b"

  on_macos do
    # macOS only
  end

  def install
    bin.install "streambreak"
  end

  def caveats
    <<~EOS
      If macOS blocks the binary (Gatekeeper), run:
        xattr -d com.apple.quarantine #{bin}/streambreak

      Then set up Claude Code hooks:
        streambreak init
    EOS
  end

  test do
    system "#{bin}/streambreak", "--version"
  end
end
