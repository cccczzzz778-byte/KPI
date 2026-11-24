-- Fix the initial account password hashes. The first migration contained hashes
-- that did not correspond to the documented starter passwords.
UPDATE users SET password_hash = 'scrypt$b10a8beb1f5b2212c488e065acf8015f$27e506c3e2d6fec6a25a4456720791995d5547e8384ea735dfd0b3b49bb740a4', updated_at = NOW() WHERE email = 'admin';
UPDATE users SET password_hash = 'scrypt$192be7f0fb02c77c81a57590f3e148e8$67296c2f5663ab4b84afae33859715e1cd65874dac7c09285dd22db0846ea649', updated_at = NOW() WHERE email = 'monitor';
UPDATE users SET password_hash = 'scrypt$b50eb404d935f623165c7376fcb2e421$b5d28c58de2db5f0768daccf031712989f77baf15ae9d4917a385012cbd53346', updated_at = NOW() WHERE email = 'baholovchi-ijro';
UPDATE users SET password_hash = 'scrypt$004be336606dfef2d48e45a7d55552d0$691ab8bf0d2d96cfee6ef5626bd1497721305b79733a6f38de49f1b2c79d9ea0', updated_at = NOW() WHERE email = 'baholovchi-birlamchi';
UPDATE users SET password_hash = 'scrypt$062e7f5646d3c428398ee2c96275ca0e$88b83a2b70432f3b827aaa5ea5217750c5d302743d0e14cefe61cf2161f153dc', updated_at = NOW() WHERE email = 'baholovchi-statsionar';
UPDATE users SET password_hash = 'scrypt$ea93261e4a4adac802616c9ab7dae0d2$033357a2ff34e75957c5f455e19910bd9a7b0ca5cb71b97e0fca6e1085db609f', updated_at = NOW() WHERE email = 'baholovchi-raqam';
UPDATE users SET password_hash = 'scrypt$64dd635853eeafe179cf8d728ee2b04f$4c416390ce3a14a36a1374be49c95e5a1b7fcbce8671e5ab32033a4a93bd5931', updated_at = NOW() WHERE email = 'baholovchi-moliya';
