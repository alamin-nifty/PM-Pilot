# packages/

Shared code lives here. The first thing to extract is a shared **model**
(`@keystone/model`) holding the normalized Person / Item / Task types, so the
context engine and the PM pilot stop keeping their own copies and can never
drift apart. See the root README for when to do that.
