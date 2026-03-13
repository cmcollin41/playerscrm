export type List = {
  name: string;
};

export type ListPerson = {
  id: string;
  lists: List;
};

export type People = {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  email_confirmed: string | null;
  list_people: ListPerson[];
  photo?: string;
  is_public?: boolean;
};
