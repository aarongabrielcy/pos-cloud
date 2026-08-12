import { CustomerCode } from "./customer-code";
import { InvalidCustomerCodeError } from "./customer.errors";

describe("CustomerCode", () => {
  it("normalizes via trim and uppercase", () => {
    expect(CustomerCode.create("  gst-mx  ").toString()).toBe("GST-MX");
  });

  it.each(["GST-MX", "ACME_01", "CLIENT001", "ABC"])("accepts a valid code: %s", (code) => {
    expect(() => CustomerCode.create(code)).not.toThrow();
  });

  it("rejects a code shorter than 3 characters", () => {
    expect(() => CustomerCode.create("AB")).toThrow(InvalidCustomerCodeError);
  });

  it("rejects a code longer than 50 characters", () => {
    expect(() => CustomerCode.create("A".repeat(51))).toThrow(InvalidCustomerCodeError);
  });

  it("rejects a code with disallowed characters", () => {
    expect(() => CustomerCode.create("GST MX")).toThrow(InvalidCustomerCodeError);
    expect(() => CustomerCode.create("GST.MX")).toThrow(InvalidCustomerCodeError);
  });

  it("equals compares normalized values", () => {
    expect(CustomerCode.create("gst-mx").equals(CustomerCode.create("GST-MX"))).toBe(true);
  });
});
