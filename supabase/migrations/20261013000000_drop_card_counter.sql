-- Les codes des flashcards sont désormais calculés par l'application (niveau + thème + origine + numéro) :
-- l'ancien compteur C0001, C0002… ne sert plus.
drop function if exists public.next_card_code();
drop sequence if exists public.card_code_seq;
