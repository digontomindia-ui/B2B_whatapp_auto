declare interface ResponseData<T> {
  error: boolean;
  message: string;
  data: T;
}
